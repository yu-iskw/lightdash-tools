import {
  AGENT_DEVELOPER_MCP_TOOL_NAMES,
  createLightdashMcpServer,
  createMcpContextProvider,
  registerAgentDeveloperTools,
} from '@lightdash-tools/mcp';

import { PACKAGE_VERSION } from './version.js';

import type { McpContextProvider } from '@lightdash-tools/mcp';
import type { McpServer as McpSdkServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type CreateAgentDeveloperServerOptions = {
  contextProvider?: McpContextProvider;
};

export function createAgentDeveloperServer(
  options?: CreateAgentDeveloperServerOptions,
): McpSdkServer {
  const server = createLightdashMcpServer({
    name: 'lightdash-agent-developer',
    version: PACKAGE_VERSION,
  });

  const contextProvider = options?.contextProvider ?? createMcpContextProvider();
  registerAgentDeveloperTools(server, contextProvider);

  return server;
}

export { AGENT_DEVELOPER_MCP_TOOL_NAMES };
