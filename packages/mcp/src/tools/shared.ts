/**
 * Shared types and helpers for MCP tool registration.
 *
 * Guardrail layers applied by registerToolSafe (outer → inner):
 *   0. Static safety filter — skips registration when the tool exceeds LIGHTDASH_TOOLS_SAFETY_MODE.
 *   1. Audit log wrapper    — captures timing and outcome for every call.
 *   2. Project allowlist      — rejects calls targeting disallowed project UUIDs at runtime.
 *   3. Input validation       — rejects invalid resource IDs (control chars, ?, #, %, path traversal).
 *   4. Dry-run or safety-mode — simulates writes, or rejects calls above the dynamic safety level.
 *   5. Raw handler            — the actual tool implementation.
 */

import {
  isAllowed,
  areAllProjectsAllowed,
  extractProjectUuids,
  hasYamlProjectDocumentArgs,
  READ_ONLY_DEFAULT,
  logAuditEntry,
  getSessionId,
  validateResourceId,
  validateResourceIdsInObject,
} from '@lightdash-tools/common';

import {
  isReadOnlyMcpScope,
  RequiredMcpScope,
  type McpToolCapability,
} from '../auth/mcp-tool-capability.js';
import { hasToolScope, requiredScopeForTool } from '../auth/token-scopes.js';
import {
  getStaticSafetyMode,
  getSafetyMode,
  getAllowedProjectUuids,
  isDryRunMode,
} from '../config.js';
import { toMcpErrorMessage } from '../errors.js';
import { getToolAuditAuth, runWithToolAuditAuthAsync } from '../tool-audit-context.js';

import type { McpContextProvider } from '../request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { z } from 'zod';

/** Prefix for all MCP tool names (disambiguation when multiple servers are connected). */
export const TOOL_PREFIX = 'ldt__';

export type TextContent = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** MCP requires structuredContent to be a record; wrap arrays and primitives. */
function toStructuredContent(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { data };
}

/** Builds a tool result with JSON text and matching structuredContent. */
export function jsonToolResult(data: unknown): TextContent {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: toStructuredContent(data),
  };
}

/**
 * When a handler returns JSON text only, attach structuredContent for MCP clients.
 */
function enrichStructuredContent(result: TextContent): TextContent {
  if (result.structuredContent !== undefined || result.isError) {
    return result;
  }
  const first = result.content[0];
  if (!first || first.type !== 'text') {
    return result;
  }
  try {
    const parsed: unknown = JSON.parse(first.text);
    if (parsed !== null && typeof parsed === 'object') {
      return {
        ...result,
        structuredContent: toStructuredContent(parsed),
      };
    }
  } catch {
    // Plain-text tool responses intentionally omit structuredContent.
  }
  return result;
}

/** Tool handler type used to avoid deep instantiation with SDK/Zod. Accepts (args, extra) for SDK compatibility. */
export type ToolHandler = (args: unknown, extra?: unknown) => Promise<TextContent>;

/** Options for registerTool; inputSchema typed as ZodRawShapeCompat for SDK compatibility. Pass annotations explicitly (e.g. READ_ONLY_DEFAULT or WRITE_IDEMPOTENT) for visibility. */
export type ToolOptions = {
  description: string;
  inputSchema: Record<string, z.ZodType>;
  title?: string;
  annotations?: ToolAnnotations;
  /** MCP Apps UI metadata (e.g. `{ ui: { resourceUri } }`). Passed through to the SDK registerTool call. */
  _meta?: Record<string, unknown>;
};

// Re-export presets used by tools and tests
export { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';

export {
  RequiredMcpScope,
  READ_ONLY_CAPABILITY,
  WRITE_IDEMPOTENT_CAPABILITY,
  type McpToolCapability,
} from '../auth/mcp-tool-capability.js';

/** Internal default for mergeAnnotations; READ_ONLY_DEFAULT is the exported preset. */
const DEFAULT_ANNOTATIONS: ToolAnnotations = READ_ONLY_DEFAULT;

type RegisterToolFn = (name: string, options: ToolOptions, handler: ToolHandler) => void;

/** Merges per-tool annotations with defaults; per-tool values win. */
function mergeAnnotations(overrides?: ToolAnnotations): ToolAnnotations {
  return { ...DEFAULT_ANNOTATIONS, ...overrides };
}

function buildAuditFields(
  name: string,
  projectUuids: string[],
  status: 'blocked' | 'error' | 'success',
  start: number,
): Parameters<typeof logAuditEntry>[0] {
  const auth = getToolAuditAuth();
  return {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    tool: name,
    projectUuids: projectUuids.length > 0 ? projectUuids : undefined,
    tokenHash: auth?.tokenHash,
    subject: auth?.subject,
    status,
    durationMs: Date.now() - start,
  };
}

/** Internal marker attached to responses produced by a guardrail (safety-mode block,
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

function validationBlockedContent(message: string): BlockedContent {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    _lightdashBlocked: true,
  };
}

function runValidation(validate: () => void, label: string): BlockedContent | undefined {
  try {
    validate();
    return undefined;
  } catch (err) {
    return validationBlockedContent(
      `Error: Invalid ${label}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function validateToolArgs(args: unknown): BlockedContent | undefined {
  for (const uuid of extractProjectUuids(args)) {
    const error = runValidation(() => validateResourceId(uuid), 'resource ID');
    if (error) return error;
  }
  const record = args as Record<string, unknown>;
  const slug = record?.slug;
  if (typeof slug === 'string') {
    const error = runValidation(() => validateResourceId(slug), 'slug');
    if (error) return error;
  }
  return runValidation(() => validateResourceIdsInObject(args), 'resource ID');
}

/**
 * Registers a tool with prefix and annotations, applying all guardrail layers.
 * shortName is prefixed to become TOOL_PREFIX + shortName.
 * Pass annotations explicitly (e.g. READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, or WRITE_DESTRUCTIVE).
 *
 * CLI flag --allowed-projects always takes priority over LIGHTDASH_TOOLS_ALLOWED_PROJECTS.
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
          text: `Error: Tool '${name}' is disabled in ${mode} mode. To enable it, change LIGHTDASH_TOOLS_SAFETY_MODE.`,
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

  // ── Input validation wrapper ─────────────────────────────────────────────
  // Validate resource IDs (projectUuid, slug, etc.) before handler.
  const validatedInner = finalHandler;
  finalHandler = async (args, extra): Promise<TextContent> => {
    const validationError = validateToolArgs(args);
    if (validationError) {
      return validationError;
    }
    return validatedInner(args, extra);
  };

  // ── Project allowlist wrapper ─────────────────────────────────────────────
  // Reject calls targeting project UUIDs not in the configured allowlist.
  // Covers both singular (projectUuid) and plural (projectUuids[]) arg shapes.
  // CLI --allowed-projects takes priority over LIGHTDASH_TOOLS_ALLOWED_PROJECTS.
  const allowedProjects = getAllowedProjectUuids();
  if (allowedProjects.length > 0) {
    const innerHandler = finalHandler;
    finalHandler = async (args, extra): Promise<TextContent> => {
      const projectUuids = extractProjectUuids(args);
      if (hasYamlProjectDocumentArgs(args) && projectUuids.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Could not extract project UUID from YAML document for allowlist check. Fix bundleYaml/gateYaml or omit the document.',
            },
          ],
          isError: true,
          _lightdashBlocked: true,
        } as BlockedContent;
      }
      const deniedUuids = projectUuids.filter(
        (uuid) => !areAllProjectsAllowed(allowedProjects, [uuid]),
      );
      if (deniedUuids.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Project(s) [${deniedUuids.join(', ')}] are not in the list of allowed projects. Allowed: [${allowedProjects.join(', ')}].`,
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
    const projectUuids = extractProjectUuids(args);
    let status: 'blocked' | 'error' | 'success' = 'success';
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
      logAuditEntry(buildAuditFields(name, projectUuids, status, start));
      throw err;
    }

    logAuditEntry(buildAuditFields(name, projectUuids, status, start));

    // Strip the internal marker before returning to the MCP client.
    const enriched = enrichStructuredContent(result);
    const { content, isError, structuredContent } = enriched;
    return structuredContent !== undefined
      ? { content, isError, structuredContent }
      : { content, isError };
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
  contextProvider: McpContextProvider,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
  options?: { requiredMcpScope?: RequiredMcpScope },
): ToolHandler {
  const requiredMcpScope = options?.requiredMcpScope ?? RequiredMcpScope.READ;
  const readOnly = isReadOnlyMcpScope(requiredMcpScope);
  return async (args: unknown, extra?: unknown) => {
    try {
      const context = await contextProvider.getContext(extra);
      const auth = context.auth;

      return await runWithToolAuditAuthAsync(
        { tokenHash: auth?.tokenHash, subject: auth?.subject, scopes: auth?.scopes },
        async () => {
          if (auth.scopes !== undefined && !hasToolScope(auth.scopes, readOnly)) {
            const required = requiredScopeForTool(readOnly);
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: insufficient_scope: tool requires OAuth scope '${required}'.`,
                },
              ],
              isError: true,
              _lightdashBlocked: true,
            } as BlockedContent;
          }

          const handler = fn(context.lightdashClient);
          return await handler(args as T);
        },
      );
    } catch (err) {
      const text = toMcpErrorMessage(err);
      return { content: [{ type: 'text', text }], isError: true };
    }
  };
}

/** Wraps a tool handler with request context and explicit OAuth scope classification. */
export function wrapToolAnnotated<T>(
  contextProvider: McpContextProvider,
  capability: McpToolCapability,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
): ToolHandler {
  return wrapTool(contextProvider, fn, { requiredMcpScope: capability.requiredMcpScope });
}
