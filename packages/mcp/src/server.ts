import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerTools } from './tools/index.js';
import { PACKAGE_VERSION } from './version.js';

import type { LightdashClient } from '@lightdash-tools/client';

export function createLightdashMcpServer(client: LightdashClient): McpServer {
  const server = new McpServer({
    name: 'lightdash-mcp',
    version: PACKAGE_VERSION,
  });
  registerTools(server, client);
  return server;
}
