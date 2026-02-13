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
import { registerQueryTools } from './query.js';
import { registerExploresTools } from './explores.js';
import { registerMetricsTools } from './metrics.js';
import { registerSchedulersTools } from './schedulers.js';
import { registerTagsTools } from './tags.js';
import { registerContentTools } from './content.js';

export function registerTools(server: McpServer, client: LightdashClient): void {
  registerProjectTools(server, client);
  registerChartTools(server, client);
  registerDashboardTools(server, client);
  registerSpaceTools(server, client);
  registerUserTools(server, client);
  registerGroupTools(server, client);
  registerQueryTools(server, client);
  registerExploresTools(server, client);
  registerMetricsTools(server, client);
  registerSchedulersTools(server, client);
  registerTagsTools(server, client);
  registerContentTools(server, client);
}
