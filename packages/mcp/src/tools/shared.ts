/**
 * Shared types and helpers for MCP tool registration.
 */

import type { LightdashClient } from '@lightdash-tools/client';
import { isAllowed, getSafetyModeFromEnv, READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { z } from 'zod';
import { toMcpErrorMessage } from '../errors.js';

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

/** Registers a tool with prefix and annotations. shortName is TOOL_PREFIX + shortName. Pass annotations explicitly (e.g. READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, or WRITE_DESTRUCTIVE). */
export function registerToolSafe(
  server: unknown,
  shortName: string,
  options: ToolOptions,
  handler: ToolHandler,
): void {
  const name = TOOL_PREFIX + shortName;
  const annotations = mergeAnnotations(options.annotations);
  const mode = getSafetyModeFromEnv();

  const isToolAllowed = isAllowed(mode, annotations);

  // If not allowed, wrap handler to return an error and update description
  let finalHandler = handler;
  let finalDescription = options.description;

  if (!isToolAllowed) {
    finalDescription = `[DISABLED in ${mode} mode] ${options.description}`;
    finalHandler = async () => ({
      content: [
        {
          type: 'text',
          text: `Error: Tool '${name}' is disabled in ${mode} mode. To enable it, change LIGHTDASH_AI_MODE.`,
        },
      ],
      isError: true,
    });
  }

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
