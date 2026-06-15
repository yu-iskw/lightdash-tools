/**
 * MCP tool registration: barrel that delegates to domain modules.
 */

import { registerAgentopsTools } from './agentops.js';
import { registerAiAgentTools } from './ai-agents.js';
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

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerProjectTools(server, contextProvider);
  registerChartTools(server, contextProvider);
  registerDashboardTools(server, contextProvider);
  registerSpaceTools(server, contextProvider);
  registerUserTools(server, contextProvider);
  registerGroupTools(server, contextProvider);
  registerQueryTools(server, contextProvider);
  registerExploresTools(server, contextProvider);
  registerMetricsTools(server, contextProvider);
  registerSchedulersTools(server, contextProvider);
  registerTagsTools(server, contextProvider);
  registerContentTools(server, contextProvider);
  registerAiAgentTools(server, contextProvider);
  registerAgentopsTools(server, contextProvider);
}
