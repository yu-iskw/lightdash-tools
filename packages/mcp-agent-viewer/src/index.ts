import {
  AGENT_VIEWER_MCP_TOOL_NAMES,
  createLightdashMcpServer,
  createMcpContextProvider,
  registerAgentViewerTools,
} from '@lightdash-tools/mcp';

import { PACKAGE_VERSION } from './version.js';

import type { McpContextProvider } from '@lightdash-tools/mcp';
import type { McpServer as McpSdkServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type CreateAgentViewerServerOptions = {
  contextProvider?: McpContextProvider;
};

export function createAgentViewerServer(options?: CreateAgentViewerServerOptions): McpSdkServer {
  const server = createLightdashMcpServer({
    name: 'lightdash-agent-viewer',
    version: PACKAGE_VERSION,
  });

  const contextProvider = options?.contextProvider ?? createMcpContextProvider();
  registerAgentViewerTools(server, contextProvider);

  return server;
}

export { AGENT_VIEWER_MCP_TOOL_NAMES };
