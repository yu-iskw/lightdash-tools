import { createLightdashMcpServer, createMcpContextProvider } from '@lightdash-tools/mcp';
import {
  registerGetProjectTool,
  registerListChartsTool,
  registerListProjectsTool,
  registerSearchContentTool,
} from '@lightdash-tools/mcp/tools';

import type { McpContextProvider } from '@lightdash-tools/mcp';

export type CreateFinanceViewerServerOptions = {
  contextProvider?: McpContextProvider;
};

export function createFinanceViewerServer(options?: CreateFinanceViewerServerOptions) {
  const server = createLightdashMcpServer({
    name: 'acme-lightdash-finance-viewer',
    version: '1.0.0',
  });

  const contextProvider = options?.contextProvider ?? createMcpContextProvider();

  registerListProjectsTool(server, contextProvider);
  registerGetProjectTool(server, contextProvider);
  registerListChartsTool(server, contextProvider);
  registerSearchContentTool(server, contextProvider);

  return server;
}
