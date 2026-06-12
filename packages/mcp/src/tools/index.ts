/**
 * MCP tool registration: barrel that delegates to domain modules.
 */

import { registerAgentopsTools } from './agentops.js';
import { registerAiAgentTools } from './ai-agents.js';
import { registerAppTools } from './apps.js';
import { registerChartTools } from './charts.js';
import { registerContentTools } from './content.js';
import { registerDashboardTools } from './dashboards.js';
import { registerExploresTools } from './explores.js';
import { registerGroupTools } from './groups.js';
import { registerMetricsTools } from './metrics.js';
import { registerProjectTools } from './projects.js';
import { registerQueryTools } from './query.js';
import { registerSchedulersTools } from './schedulers.js';
import { registerSpaceTools } from './spaces.js';
import { registerTagsTools } from './tags.js';
import { registerUserTools } from './users.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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
  registerAiAgentTools(server, client);
  registerAgentopsTools(server, client);
  registerAppTools(server, client);
}
