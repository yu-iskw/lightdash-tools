/**
 * Shared types and helpers for MCP tool registration.
 */

import type { LightdashClient } from '@lightdash-tools/client';
import type { z } from 'zod';
import { toMcpErrorMessage } from '../errors.js';

/** Prefix for all MCP tool names (disambiguation when multiple servers are connected). */
export const TOOL_PREFIX = 'lightdash_tools__';

export type TextContent = {
  content: Array<{ type: 'text'; text: string }>;
};

/** Tool handler type used to avoid deep instantiation with SDK/Zod. Accepts (args, extra) for SDK compatibility. */
export type ToolHandler = (args: unknown, extra?: unknown) => Promise<TextContent>;

/** MCP tool annotations (hints for client display and approval). See MCP spec Tool annotations. */
export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

/** Options for registerTool; inputSchema typed as ZodRawShapeCompat for SDK compatibility. Pass annotations explicitly (e.g. READ_ONLY_DEFAULT or WRITE_IDEMPOTENT) for visibility. */
export type ToolOptions = {
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  title?: string;
  annotations?: ToolAnnotations;
};

/** Preset: read-only, non-destructive, idempotent, closed-world. Use for list/get/compile tools. */
export const READ_ONLY_DEFAULT: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/** Preset: write, non-destructive, idempotent (e.g. upsert by slug). Use for create/update tools. */
export const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

/** Preset: write, destructive, non-idempotent. Use for delete/remove tools; clients should prompt for user confirmation. */
export const WRITE_DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true,
  idempotentHint: false,
};

/** Internal default for mergeAnnotations; READ_ONLY_DEFAULT is the exported preset. */
const DEFAULT_ANNOTATIONS: ToolAnnotations = READ_ONLY_DEFAULT;

type RegisterToolFn = (name: string, options: ToolOptions, handler: ToolHandler) => void;

/** Merges per-tool annotations with defaults; per-tool values win. */
function mergeAnnotations(overrides?: ToolAnnotations): ToolAnnotations {
  return { ...DEFAULT_ANNOTATIONS, ...overrides };
}

/** Registers a tool with prefix and annotations. shortName is TOOL_PREFIX + shortName. Pass annotations explicitly (e.g. READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, or WRITE_DESTRUCTIVE). */
export function registerToolSafe(
  server: unknown,
  shortName: string,
  options: ToolOptions,
  handler: ToolHandler,
): void {
  const name = TOOL_PREFIX + shortName;
  const annotations = mergeAnnotations(options.annotations);
  const mergedOptions: ToolOptions = {
    ...options,
    title: options.title ?? options.annotations?.title,
    annotations,
  };
  (server as { registerTool: RegisterToolFn }).registerTool(name, mergedOptions, handler);
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
      return { content: [{ type: 'text', text }] };
    }
  };
}
