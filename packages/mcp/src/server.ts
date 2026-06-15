import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider } from './request-context.js';

export function createLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer {
  const server = new McpServer({
    name: 'lightdash-mcp',
    version: PACKAGE_VERSION,
  });
  registerCapabilities(server, contextProvider, options);
  return server;
}
