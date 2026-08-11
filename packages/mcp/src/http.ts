/**
 * MCP server entrypoint (Streamable HTTP).
 * Prefer `lightdash-mcp http` (bin) which resolves prompt-context before start.
 */

import { loadMcpHttpConfig } from './config/load-mcp-config.js';
import { startStreamableHttpServer } from './transports/streamable-http.js';

import type { PromptContextPolicy } from './config/prompt-context-policy.js';

export type StartHttpOptions = {
  promptContextPolicy?: PromptContextPolicy;
};

/** Start Streamable HTTP MCP (optional resolved prompt-context policy from CLI). */
export async function startHttp(options?: StartHttpOptions): Promise<void> {
  const config = loadMcpHttpConfig();
  await startStreamableHttpServer(
    options?.promptContextPolicy !== undefined
      ? { ...config, promptContextPolicy: options.promptContextPolicy }
      : config,
  );
}
