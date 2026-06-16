import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider } from './request-context.js';

export type LightdashMcpServerOptions = {
  name: string;
  version: string;
};

/**
 * Bare MCP server shell with custom name/version.
 * Persona packages use this and then register only the tools they need.
 */
export function createLightdashMcpServer(options: LightdashMcpServerOptions): McpServer {
  return new McpServer({
    name: options.name,
    version: options.version,
  });
}

/**
 * Generic Lightdash MCP server that registers all standard capabilities/tools.
 * This preserves the existing operator behavior of `@lightdash-tools/mcp`.
 */
export function createGenericLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer {
  const server = createLightdashMcpServer({ name: 'lightdash-mcp', version: PACKAGE_VERSION });
  registerCapabilities(server, contextProvider, options);
  return server;
}
