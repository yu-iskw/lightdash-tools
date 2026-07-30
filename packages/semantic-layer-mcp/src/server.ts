import { McpServer } from '@modelcontextprotocol/server';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { McpContextProvider } from './request-context.js';

export function createSemanticLayerMcpServer(contextProvider: McpContextProvider): McpServer {
  const server = new McpServer({
    name: 'lightdash-semantic-layer-mcp',
    version: PACKAGE_VERSION,
  });
  registerCapabilities(server, contextProvider);
  return server;
}
