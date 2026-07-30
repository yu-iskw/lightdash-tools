/**
 * Semantic-layer MCP server entrypoint (Stdio).
 * Use LIGHTDASH_URL and LIGHTDASH_API_KEY. Logging: stderr only.
 *
 * MCP SDK v2 (ADR-0041): use server.connect(StdioServerTransport).
 * Do not switch to serveStdio without an explicit protocol-era decision —
 * Claude Code and Cursor rely on this compatibility-first stdio path.
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { EnvContextProvider } from './auth/env-context-provider.js';
import { createSemanticLayerMcpServer } from './server.js';

async function main(): Promise<void> {
  const contextProvider = new EnvContextProvider();
  const server = createSemanticLayerMcpServer(contextProvider);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lightdash semantic-layer MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
