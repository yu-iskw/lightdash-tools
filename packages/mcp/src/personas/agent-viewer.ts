/**
 * Curated viewer-baseline tool registration shared by persona packages.
 */

import {
  registerCompileQueryTool,
  registerGetExploreTool,
  registerGetFieldLineageTool,
  registerGetProjectTool,
  registerGetSpaceTool,
  registerGetValidationResultsTool,
  registerListChartsAsCodeTool,
  registerListChartsTool,
  registerListDashboardsTool,
  registerListDimensionsTool,
  registerListExploresTool,
  registerListMetricsTool,
  registerListProjectsTool,
  registerListSchedulersTool,
  registerListSpacesTool,
  registerListTagsTool,
  registerSearchContentTool,
} from '../tools/index.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const AGENT_VIEWER_TOOL_SHORT_NAMES = [
  'list_projects',
  'get_project',
  'get_validation_results',
  'list_charts',
  'list_charts_as_code',
  'list_dashboards',
  'list_spaces',
  'get_space',
  'search_content',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'get_field_lineage',
  'list_metrics',
  'list_tags',
  'compile_query',
  'list_schedulers',
] as const;

export const AGENT_VIEWER_MCP_TOOL_NAMES = AGENT_VIEWER_TOOL_SHORT_NAMES.map(
  (shortName) => `${TOOL_PREFIX}${shortName}`,
);

export function registerAgentViewerTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerListProjectsTool(server, contextProvider);
  registerGetProjectTool(server, contextProvider);
  registerGetValidationResultsTool(server, contextProvider);

  registerListChartsTool(server, contextProvider);
  registerListChartsAsCodeTool(server, contextProvider);

  registerListDashboardsTool(server, contextProvider);

  registerListSpacesTool(server, contextProvider);
  registerGetSpaceTool(server, contextProvider);

  registerSearchContentTool(server, contextProvider);

  registerListExploresTool(server, contextProvider);
  registerGetExploreTool(server, contextProvider);
  registerListDimensionsTool(server, contextProvider);
  registerGetFieldLineageTool(server, contextProvider);

  registerListMetricsTool(server, contextProvider);
  registerListTagsTool(server, contextProvider);
  registerCompileQueryTool(server, contextProvider);

  registerListSchedulersTool(server, contextProvider);
}
