/**
 * Shared types and helpers for MCP tool registration.
 *
 * Guardrail layers applied by registerToolSafe (outer → inner):
 *   1. Audit log wrapper    — captures timing and outcome for every call.
 *   2. HTTP project pin       — rejects projectUuid(s) that do not match X-Lightdash-Project (ALS).
 *   3. Input validation       — rejects invalid resource IDs (control chars, ?, #, %, path traversal).
 *   4. Raw handler            — the actual tool implementation.
 *
 * Capability surface is the persona toolIds allowlist (ADR-0006), not process safety mode.
 */

import {
  extractProjectUuids,
  READ_ONLY_DEFAULT,
  logAuditEntry,
  getSessionId,
  validateResourceIdsInObject,
} from '@lightdash-tools/common';
import { isInputRequiredResult } from '@modelcontextprotocol/server';

import { getToolAuditAuth, runWithToolAuditAuthAsync } from '../audit/tool-audit-context.js';
import {
  resolveMcpClientSessionId,
  runWithMcpClientSessionAsync,
} from '../governance/mcp-client-session.js';
import { getPinnedProjectUuid } from '../governance/project-pin.js';
import { toMcpErrorMessage } from '../server/errors.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { AuditStatus, ToolAnnotations } from '@lightdash-tools/common';
import type { InputRequiredResult, ServerContext } from '@modelcontextprotocol/server';
import type { z } from 'zod';

/** Prefix for all MCP tool names (disambiguation when multiple servers are connected). */
export const TOOL_PREFIX = 'lightdash_';

export type TextContent = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Handler return type: normal tool content or MCP 2026-07-28 MRTR InputRequiredResult. */
export type ToolResult = InputRequiredResult | TextContent;

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
export type ToolHandler = (args: unknown, extra?: unknown) => Promise<ToolResult>;

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
export { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

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
  status: AuditStatus,
  start: number,
  auth: ReturnType<typeof getToolAuditAuth>,
): Parameters<typeof logAuditEntry>[0] {
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

/** Internal marker attached to responses produced by a guardrail (project-pin denial
 * or input-validation failure). The audit wrapper reads this flag
 * to set status = 'blocked', then strips it before returning to the MCP client.
 */
type BlockedContent = TextContent & { readonly _lightdashBlocked: true };

type AuditedContent = TextContent & {
  readonly _lightdashBlocked?: true;
  readonly _lightdashAuditStatus?: AuditStatus;
};

function isGuardrailBlocked(result: TextContent): result is BlockedContent {
  return (
    '_lightdashBlocked' in result &&
    (result as Record<string, unknown>)['_lightdashBlocked'] === true
  );
}

function resolveAuditStatus(result: ToolResult): AuditStatus {
  if (isInputRequiredResult(result)) {
    return 'confirmation_requested';
  }
  const audited = result as AuditedContent;
  if (typeof audited._lightdashAuditStatus === 'string') {
    return audited._lightdashAuditStatus;
  }
  if (isGuardrailBlocked(result)) {
    return 'blocked';
  }
  if (result.isError) {
    return 'error';
  }
  return 'success';
}

/** Guardrail-blocked tool result; audit wrapper strips `_lightdashBlocked`. */
export function blockedToolContent(message: string): BlockedContent {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    _lightdashBlocked: true,
  };
}

/**
 * Attach `_lightdashBlocked` so audit status is `blocked` (stripped before MCP client).
 * Prefer for policy denials that already have JSON content + structuredContent.
 */
export function withLightdashBlockedMarker<T extends TextContent>(result: T): BlockedContent & T {
  return { ...result, _lightdashBlocked: true };
}

/** Attach a specific audit status (stripped before MCP client). */
export function withAuditStatus<T extends TextContent>(
  result: T,
  status: AuditStatus,
): AuditedContent & T {
  return { ...result, _lightdashAuditStatus: status };
}

/**
 * Registers a tool with prefix and annotations, applying pin / validation / audit guardrails.
 * shortName is prefixed to become TOOL_PREFIX + shortName.
 * Pass annotations explicitly (e.g. READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, or WRITE_DESTRUCTIVE).
 * Handlers may return TextContent or InputRequiredResult (MRTR elicitation).
 */
export function registerToolSafe(
  server: unknown,
  shortName: string,
  options: ToolOptions,
  handler: ToolHandler,
): void {
  const name = TOOL_PREFIX + shortName;
  const annotations = mergeAnnotations(options.annotations);

  let finalHandler: ToolHandler = handler;

  // ── Input validation wrapper ─────────────────────────────────────────────
  // Validate resource IDs (projectUuid, projectUuids, slug, etc.) before handler.
  const validatedInner = finalHandler;
  finalHandler = async (args, extra): Promise<ToolResult> => {
    try {
      validateResourceIdsInObject(args);
    } catch (err) {
      return blockedToolContent(
        `Error: Invalid resource ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return validatedInner(args, extra);
  };

  // ── HTTP project pin wrapper ──────────────────────────────────────────────
  // When X-Lightdash-Project is set (ALS), reject tools that target another project.
  const pinInner = finalHandler;
  finalHandler = async (args, extra): Promise<ToolResult> => {
    const pinned = getPinnedProjectUuid();
    if (pinned) {
      const projectUuids = extractProjectUuids(args);
      const mismatched = projectUuids.filter((uuid) => uuid !== pinned);
      if (mismatched.length > 0) {
        return blockedToolContent(
          `Error: Project(s) [${mismatched.join(', ')}] do not match the pinned project ${pinned} (X-Lightdash-Project).`,
        );
      }
    }
    return pinInner(args, extra);
  };

  // ── Audit log wrapper ─────────────────────────────────────────────────────
  // Outermost layer: records timing and outcome for every call.
  const auditedInner = finalHandler;
  finalHandler = async (args, extra): Promise<ToolResult> => {
    const start = Date.now();
    const projectUuids = extractProjectUuids(args);
    // Snapshot before await — wrapTool ALS may end when the handler returns.
    const auth = getToolAuditAuth();
    let status: AuditStatus = 'success';
    let result: ToolResult;

    try {
      result = await auditedInner(args, extra);
      status = resolveAuditStatus(result);
    } catch (err) {
      status = 'error';
      logAuditEntry(buildAuditFields(name, projectUuids, status, start, auth));
      throw err;
    }

    logAuditEntry(buildAuditFields(name, projectUuids, status, start, auth));

    // Pass InputRequiredResult through unchanged (MRTR).
    if (isInputRequiredResult(result)) {
      return result;
    }

    // Strip internal markers before returning to the MCP client.
    const enriched = enrichStructuredContent(result);
    const { content, isError, structuredContent } = enriched;
    return structuredContent !== undefined
      ? { content, isError, structuredContent }
      : { content, isError };
  };

  const mergedOptions: ToolOptions = {
    ...options,
    title: options.title ?? options.annotations?.title,
    annotations,
  };
  (server as { registerTool: RegisterToolFn }).registerTool(name, mergedOptions, finalHandler);
}

export type ToolExecutionContext = {
  lightdashClient: LightdashClient;
  /** SDK ServerContext when the transport provides it (second registerTool arg). */
  serverContext: ServerContext | undefined;
  sessionId: string;
};

function asServerContext(extra: unknown): ServerContext | undefined {
  if (extra !== null && typeof extra === 'object' && 'mcpReq' in extra) {
    return extra as ServerContext;
  }
  return undefined;
}

/** Like wrapTool, but passes ServerContext / session / auth for elicitation-capable tools. */
export function wrapToolContextual<T>(
  contextProvider: McpContextProvider,
  fn: (ctx: ToolExecutionContext) => (args: T) => Promise<ToolResult>,
): ToolHandler {
  return async (args: unknown, extra?: unknown) => {
    const sessionId = resolveMcpClientSessionId(extra);
    try {
      return await runWithMcpClientSessionAsync(sessionId, async () => {
        const context = await contextProvider.getContext(extra);
        const auth = context.auth;

        return await runWithToolAuditAuthAsync(
          { tokenHash: auth?.tokenHash, subject: auth?.subject },
          async () => {
            const execution: ToolExecutionContext = {
              lightdashClient: context.lightdashClient,
              serverContext: asServerContext(extra),
              sessionId,
            };
            const handler = fn(execution);
            return await handler(args as T);
          },
        );
      });
    } catch (err) {
      const text = toMcpErrorMessage(err);
      return { content: [{ type: 'text', text }], isError: true };
    }
  };
}

export function wrapTool<T>(
  contextProvider: McpContextProvider,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
): ToolHandler {
  return wrapToolContextual<T>(contextProvider, (ctx) => {
    const inner = fn(ctx.lightdashClient);
    return async (args) => inner(args);
  });
}
