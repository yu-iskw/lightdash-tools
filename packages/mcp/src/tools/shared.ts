/**
 * Shared types and helpers for MCP tool registration.
 *
 * Guardrail layers applied by registerToolSafe (outer → inner):
 *   1. Audit log wrapper       — captures timing and outcome for every call.
 *   2. Project scope           — pin mismatch + LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS membership.
 *   3. Input validation        — rejects invalid resource IDs (control chars, ?, #, %, path traversal).
 *   4. Raw handler             — the actual tool implementation.
 *
 * Capability surface is the profile's tools array, not process safety mode.
 */

import {
  buildAuditLogEntry,
  extractProjectUuids,
  ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS,
  READ_ONLY_DEFAULT,
  logAuditEntry,
  validateResourceIdsInObject,
} from '@lightdash-tools/common';
import { isInputRequiredResult } from '@modelcontextprotocol/server';

import { getServerProfile } from '../audit/server-profile.js';
import { getToolAuditAuth, runWithToolAuditAuthAsync } from '../audit/tool-audit-context.js';
import { findUnavailableProjectUuids } from '../governance/available-projects.js';
import {
  resolveMcpClientSessionId,
  runWithMcpClientSessionAsync,
} from '../governance/mcp-client-session.js';
import { getPinnedProjectUuid } from '../governance/project-pin.js';
import { createOperationReporter } from '../notifications/operation-reporter.js';
import { classifyUpstreamError } from '../server/upstream-errors.js';

import type { OperationReporter } from '../notifications/operation-reporter.js';
import type { McpContextProvider } from '../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { AuditStatus, ToolAnnotations } from '@lightdash-tools/common';
import type { InputRequiredResult, ServerContext } from '@modelcontextprotocol/server';
import type { z } from 'zod';

/** Prefix for all MCP tool names (disambiguation when multiple servers are connected). */
export const TOOL_PREFIX = 'lightdash_';

export type ImageContentBlock = {
  type: 'image';
  data: string;
  mimeType: string;
};

/** MCP embedded resource content block (tool-result artifacts). */
export type ResourceContentBlock = {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text: string;
  };
  annotations?: {
    audience?: Array<'assistant' | 'user'>;
    priority?: number;
  };
};

export type ToolContentBlock =
  ImageContentBlock | ResourceContentBlock | { type: 'text'; text: string };

export type TextContent = {
  content: ToolContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Kind of bulky payload kept out of the compact summary body (ADR-0032). */
export type ToolArtifactKind = 'data' | 'sql';

export type ToolArtifactSpec = {
  kind: ToolArtifactKind;
  uri: string;
  mimeType: string;
  text: string;
  audience: Array<'assistant' | 'user'>;
  priority?: number;
};

export type ToolArtifactCatalogEntry = {
  kind: ToolArtifactKind;
  uri: string;
  mimeType: string;
  included: boolean;
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

/** Optional additive fields on structured tool errors (RFC progressive-disclosure recovery). */
export type ToolErrorExtras = {
  recovery?: string;
  playbookUri?: string;
};

/** Tool execution error with structured `{ error: { code, message } }` (not policy-blocked). */
export function toolErrorResult(
  code: string,
  message: string,
  extras?: ToolErrorExtras,
): TextContent {
  const error: { code: string; message: string; recovery?: string; playbookUri?: string } = {
    code,
    message,
  };
  if (extras?.recovery !== undefined) {
    error.recovery = extras.recovery;
  }
  if (extras?.playbookUri !== undefined) {
    error.playbookUri = extras.playbookUri;
  }
  return { ...jsonToolResult({ error }), isError: true };
}

/**
 * MCP ImageContent + metadata text. structuredContent holds meta only (no base64).
 * Spec: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
 */
export function imageToolResult(args: {
  meta: Record<string, unknown>;
  imageBase64: string;
  mimeType?: string;
}): TextContent {
  const mimeType = args.mimeType ?? 'image/png';
  return {
    content: [
      { type: 'text', text: JSON.stringify(args.meta, null, 2) },
      { type: 'image', data: args.imageBase64, mimeType },
    ],
    structuredContent: toStructuredContent(args.meta),
  };
}

/**
 * Compact summary + optional embedded resource artifacts (ADR-0032).
 * Spec: https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-result
 * structuredContent holds summary only (no SQL body / row payloads).
 */
export function artifactToolResult(args: {
  summary: Record<string, unknown>;
  artifacts?: ToolArtifactSpec[];
  catalog?: ToolArtifactCatalogEntry[];
}): TextContent {
  const artifacts = args.artifacts ?? [];
  const catalog =
    args.catalog ??
    artifacts.map((a) => ({
      kind: a.kind,
      uri: a.uri,
      mimeType: a.mimeType,
      included: true,
    }));
  const summary = {
    ...args.summary,
    artifacts: catalog,
  };
  const content: ToolContentBlock[] = [
    { type: 'text', text: JSON.stringify(summary, null, 2) },
    ...artifacts.map((a): ResourceContentBlock => ({
      type: 'resource',
      resource: {
        uri: a.uri,
        mimeType: a.mimeType,
        text: a.text,
      },
      annotations: {
        audience: a.audience,
        ...(a.priority !== undefined ? { priority: a.priority } : {}),
      },
    })),
  ];
  return {
    content,
    structuredContent: toStructuredContent(summary),
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

  // ── Project pin + shared allowlist ────────────────────────────────────────
  // One ALS read + one arg extract: pin mismatch, then ALLOWED_PROJECT_UUIDS membership.
  const scopeInner = finalHandler;
  finalHandler = async (args, extra): Promise<ToolResult> => {
    const pinned = getPinnedProjectUuid();
    const projectUuids = extractProjectUuids(args);
    if (pinned) {
      const pinnedLower = pinned.toLowerCase();
      const mismatched = projectUuids.filter((uuid) => uuid.toLowerCase() !== pinnedLower);
      if (mismatched.length > 0) {
        return blockedToolContent(
          `Error: Project(s) [${mismatched.join(', ')}] do not match the pinned project ${pinned} (X-Lightdash-Project).`,
        );
      }
    }
    // After pin match, args equal the pin — check pin alone; else check arg UUIDs.
    const candidates = pinned ? [pinned] : projectUuids;
    const unavailable = findUnavailableProjectUuids(candidates);
    if (unavailable.length > 0) {
      return blockedToolContent(
        `Error: PROJECT_NOT_AVAILABLE: Project(s) [${unavailable.join(', ')}] are not in ${ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS}.`,
      );
    }
    return scopeInner(args, extra);
  };

  // ── Audit log wrapper ─────────────────────────────────────────────────────
  // Outermost layer: records timing and outcome for every call.
  // profileId is fixed at registration (bindServerProfile before registerTools).
  const profileId =
    typeof server === 'object' && server !== null ? getServerProfile(server) : undefined;
  const auditedInner = finalHandler;
  finalHandler = async (args, extra): Promise<ToolResult> => {
    const startMs = Date.now();
    const projectUuids = extractProjectUuids(args);
    // Snapshot before await — wrapTool ALS may end when the handler returns.
    const auth = getToolAuditAuth();
    const clientSessionId = resolveMcpClientSessionId(extra);
    let status: AuditStatus = 'success';
    let result!: ToolResult;

    try {
      result = await auditedInner(args, extra);
      status = resolveAuditStatus(result);
    } catch (err) {
      status = 'error';
      throw err;
    } finally {
      logAuditEntry(
        buildAuditLogEntry({
          tool: name,
          status,
          startMs,
          projectUuids,
          tokenHash: auth?.tokenHash,
          subject: auth?.subject,
          clientSessionId,
          profileId,
        }),
      );
    }

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
  /** Request-scoped reporter backed by MCP progress notifications when available. */
  operationReporter: OperationReporter;
  /** SDK ServerContext when the transport provides it (second registerTool arg). */
  serverContext: ServerContext | undefined;
  sessionId: string;
  /** Authenticated principal for signed handles (ADR-0019); anonymous when unset. */
  subject: string;
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
        const serverContext = asServerContext(extra);

        return await runWithToolAuditAuthAsync(
          { tokenHash: auth?.tokenHash, subject: auth?.subject },
          async () => {
            const execution: ToolExecutionContext = {
              lightdashClient: context.lightdashClient,
              operationReporter: createOperationReporter(serverContext),
              serverContext,
              sessionId,
              subject: auth?.subject ?? 'anonymous',
            };
            const handler = fn(execution);
            return await handler(args as T);
          },
        );
      });
    } catch (err) {
      const { code, message } = classifyUpstreamError(err);
      return toolErrorResult(code, message);
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
