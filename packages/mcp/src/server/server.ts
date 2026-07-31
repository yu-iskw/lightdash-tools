import { McpServer } from '@modelcontextprotocol/server';

import { getDefaultPersona } from '../personas/index.js';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider } from './request-context.js';

export function createLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer {
  const persona = options?.persona ?? getDefaultPersona();
  const server = new McpServer({
    name: `lightdash-mcp-${persona.id}`,
    version: PACKAGE_VERSION,
  });
  registerCapabilities(server, contextProvider, { ...options, persona });
  return server;
}
