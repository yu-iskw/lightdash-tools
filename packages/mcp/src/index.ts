/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getClient, getAuditLogPath } from './config.js';
import { initAuditLog } from './audit.js';
import { registerTools } from './tools/index.js';

async function main(): Promise<void> {
  initAuditLog(getAuditLogPath());

  const client = getClient();
  const server = new McpServer({
    name: 'lightdash-mcp',
    version: '1.0.0',
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lightdash MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
