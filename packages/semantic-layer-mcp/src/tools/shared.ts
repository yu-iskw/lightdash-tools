/**
 * Thin tool helpers for semantic-layer MCP (no safety-mode / allowlist / audit stack).
 */

import type { McpContextProvider } from '../request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';

export type TextContent = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** Builds a tool result with pretty-printed JSON text. */
export function jsonToolResult(data: unknown): TextContent {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

type ToolHandler = (args: unknown, extra?: unknown) => Promise<TextContent>;

/**
 * Resolves the Lightdash client from request context and maps thrown errors to isError results.
 */
export function wrapTool<T>(
  contextProvider: McpContextProvider,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
): ToolHandler {
  return async (args: unknown, extra?: unknown) => {
    try {
      const context = await contextProvider.getContext(extra);
      const handler = fn(context.lightdashClient);
      return await handler(args as T);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
    }
  };
}
