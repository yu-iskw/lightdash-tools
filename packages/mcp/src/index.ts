/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { initAuditLog } from './audit.js';
import { EnvContextProvider } from './auth/env-context-provider.js';
import { getAuditLogPath } from './config.js';
import { createLightdashMcpServer } from './server.js';

async function main(): Promise<void> {
  initAuditLog(getAuditLogPath());

  const contextProvider = new EnvContextProvider();
  const server = createLightdashMcpServer(contextProvider);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lightdash MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
