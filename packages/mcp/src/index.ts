/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { initAuditLog } from './audit.js';
import { getClient, getAuditLogPath } from './config.js';
import { createLightdashMcpServer } from './server.js';

async function main(): Promise<void> {
  initAuditLog(getAuditLogPath());

  const client = getClient();
  const server = createLightdashMcpServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lightdash MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
