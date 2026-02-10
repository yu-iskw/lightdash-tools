/**
 * MCP tool registration: barrel that delegates to domain modules.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { registerProjectTools } from './projects.js';
import { registerChartTools } from './charts.js';
import { registerDashboardTools } from './dashboards.js';
import { registerSpaceTools } from './spaces.js';
import { registerUserTools } from './users.js';
import { registerGroupTools } from './groups.js';

export function registerTools(server: McpServer, client: LightdashClient): void {
  registerProjectTools(server, client);
  registerChartTools(server, client);
  registerDashboardTools(server, client);
  registerSpaceTools(server, client);
  registerUserTools(server, client);
  registerGroupTools(server, client);
}
