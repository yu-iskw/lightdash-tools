/**
 * Shared types and helpers for MCP tool registration.
 *
 * Guardrail layers applied by registerToolSafe (outer → inner):
 *   1. Audit log wrapper   — captures timing and outcome for every call.
 *   2. Project allowlist   — rejects calls targeting disallowed project UUIDs at runtime.
 *   3. Dry-run wrapper     — simulates writes without executing them (registration-time).
 *   4. Safety-mode wrapper — disables tools that exceed the configured safety level.
 *   5. Raw handler         — the actual tool implementation.
 */

import type { LightdashClient } from '@lightdash-tools/client';
import { isAllowed, isProjectAllowed, READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { z } from 'zod';
import { toMcpErrorMessage } from '../errors.js';
import {
  getStaticSafetyMode,
  getSafetyMode,
  getAllowedProjectUuids,
  isDryRunMode,
} from '../config.js';
import { logAuditEntry, getSessionId } from '../audit.js';

/** Prefix for all MCP tool names (disambiguation when multiple servers are connected). */
export const TOOL_PREFIX = 'lightdash_tools__';

export type TextContent = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** Tool handler type used to avoid deep instantiation with SDK/Zod. Accepts (args, extra) for SDK compatibility. */
export type ToolHandler = (args: unknown, extra?: unknown) => Promise<TextContent>;

/** Options for registerTool; inputSchema typed as ZodRawShapeCompat for SDK compatibility. Pass annotations explicitly (e.g. READ_ONLY_DEFAULT or WRITE_IDEMPOTENT) for visibility. */
export type ToolOptions = {
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  title?: string;
  annotations?: ToolAnnotations;
};

// Re-export presets for convenience and backward compatibility in tools
export { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';

/** Internal default for mergeAnnotations; READ_ONLY_DEFAULT is the exported preset. */
const DEFAULT_ANNOTATIONS: ToolAnnotations = READ_ONLY_DEFAULT;

type RegisterToolFn = (name: string, options: ToolOptions, handler: ToolHandler) => void;

/** Merges per-tool annotations with defaults; per-tool values win. */
function mergeAnnotations(overrides?: ToolAnnotations): ToolAnnotations {
  return { ...DEFAULT_ANNOTATIONS, ...overrides };
}

/**
 * Internal marker attached to responses produced by a guardrail (safety-mode block,
 * dry-run simulation, or project-allowlist denial). The audit wrapper reads this flag
 * to set status = 'blocked', then strips it before returning to the MCP client.
 */
type BlockedContent = TextContent & { readonly _lightdashBlocked: true };

function isGuardrailBlocked(result: TextContent): result is BlockedContent {
  return (
    '_lightdashBlocked' in result &&
    (result as Record<string, unknown>)['_lightdashBlocked'] === true
  );
}

/** Extracts the projectUuid string from tool args if present. */
function extractProjectUuid(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const a = args as Record<string, unknown>;
  return typeof a['projectUuid'] === 'string' ? a['projectUuid'] : undefined;
}

/**
 * Registers a tool with prefix and annotations, applying all guardrail layers.
 * shortName is prefixed to become TOOL_PREFIX + shortName.
 * Pass annotations explicitly (e.g. READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, or WRITE_DESTRUCTIVE).
 */
export function registerToolSafe(
  server: unknown,
  shortName: string,
  options: ToolOptions,
  handler: ToolHandler,
): void {
  const name = TOOL_PREFIX + shortName;
  const annotations = mergeAnnotations(options.annotations);

  // ── Static Filtering ──────────────────────────────────────────────────────
  // Skip registration entirely if the tool exceeds the static safety mode.
  const staticMode = getStaticSafetyMode();
  if (staticMode && !isAllowed(staticMode, annotations)) {
    return;
  }

  // ── Safety-mode wrapper ───────────────────────────────────────────────────
  // Tool is registered but calls are rejected at runtime when the dynamic mode
  // does not permit the operation.
  const mode = getSafetyMode();
  const isToolAllowed = isAllowed(mode, annotations);
  const isReadOnly = !!annotations.readOnlyHint;

  let finalHandler: ToolHandler = handler;
  let finalDescription = options.description;

  if (!isToolAllowed) {
    finalDescription = `[DISABLED in ${mode} mode] ${options.description}`;
    finalHandler = async (): Promise<BlockedContent> => ({
      content: [
        {
          type: 'text',
          text: `Error: Tool '${name}' is disabled in ${mode} mode. To enable it, change LIGHTDASH_TOOL_SAFETY_MODE.`,
        },
      ],
      isError: true,
      _lightdashBlocked: true,
    });
  } else if (isDryRunMode() && !isReadOnly) {
    // ── Dry-run wrapper ─────────────────────────────────────────────────────
    // Write operations are simulated; no API calls are made.
    finalDescription = `[DRY-RUN] ${options.description}`;
    finalHandler = async (args): Promise<BlockedContent> => ({
      content: [
        {
          type: 'text',
          text: `[DRY-RUN] Tool '${name}' would be called with: ${JSON.stringify(args, null, 2)}. No changes were made.`,
        },
      ],
      _lightdashBlocked: true,
    });
  }

  // ── Project allowlist wrapper ─────────────────────────────────────────────
  // Reject calls targeting project UUIDs not in the configured allowlist.
  const allowedProjects = getAllowedProjectUuids();
  if (allowedProjects.length > 0) {
    const innerHandler = finalHandler;
    finalHandler = async (args, extra): Promise<TextContent> => {
      const projectUuid = extractProjectUuid(args);
      if (projectUuid !== undefined && !isProjectAllowed(allowedProjects, projectUuid)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Project '${projectUuid}' is not in the list of allowed projects. Allowed: [${allowedProjects.join(', ')}].`,
            },
          ],
          isError: true,
          _lightdashBlocked: true,
        } as BlockedContent;
      }
      return innerHandler(args, extra);
    };
  }

  // ── Audit log wrapper ─────────────────────────────────────────────────────
  // Outermost layer: records timing and outcome for every call.
  const auditedInner = finalHandler;
  finalHandler = async (args, extra): Promise<TextContent> => {
    const start = Date.now();
    const projectUuid = extractProjectUuid(args);
    let status: 'success' | 'error' | 'blocked' = 'success';
    let result: TextContent;

    try {
      result = await auditedInner(args, extra);
      if (isGuardrailBlocked(result)) {
        status = 'blocked';
      } else if (result.isError) {
        status = 'error';
      }
    } catch (err) {
      status = 'error';
      logAuditEntry({
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        tool: name,
        projectUuid,
        status,
        durationMs: Date.now() - start,
      });
      throw err;
    }

    logAuditEntry({
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      tool: name,
      projectUuid,
      status,
      durationMs: Date.now() - start,
    });

    // Strip the internal marker before returning to the MCP client.
    const { content, isError } = result;
    return { content, isError };
  };

  const mergedOptions: ToolOptions = {
    ...options,
    description: finalDescription,
    title: options.title ?? options.annotations?.title,
    annotations,
  };
  (server as { registerTool: RegisterToolFn }).registerTool(name, mergedOptions, finalHandler);
}

export function wrapTool<T>(
  client: LightdashClient,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
): ToolHandler {
  const handler = fn(client);
  return async (args: unknown, extra?: unknown) => {
    void extra;
    try {
      return await handler(args as T);
    } catch (err) {
      const text = toMcpErrorMessage(err);
      return { content: [{ type: 'text', text }], isError: true };
    }
  };
}
