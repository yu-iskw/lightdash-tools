/**
 * Curated developer persona tools (viewer baseline plus restricted writes).
 */

import {
  registerAiAgentopsApplyTool,
  registerAiAgentopsPlanTool,
  registerAppendAgentEvaluationPromptsTool,
  registerCreateAgentEvaluationTool,
  registerCreateProjectAgentTool,
  registerGetAgentEvaluationRunResultsTool,
  registerGetAgentEvaluationTool,
  registerGetProjectAgentTool,
  registerListAgentEvaluationRunsTool,
  registerListAgentEvaluationsTool,
  registerListProjectAgentsTool,
  registerRunAgentEvaluationTool,
  registerUpdateAgentEvaluationTool,
  registerUpdateProjectAgentTool,
  registerUpsertChartAsCodeTool,
  registerValidateProjectTool,
} from '../tools/index.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import { AGENT_VIEWER_MCP_TOOL_NAMES, registerAgentViewerTools } from './agent-viewer.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const AGENT_DEVELOPER_ADDITIONAL_TOOL_SHORT_NAMES = [
  'validate_project',
  'upsert_chart_as_code',
  'ai_agentops_plan',
  'ai_agentops_apply',
  'list_project_agents',
  'get_project_agent',
  'create_project_agent',
  'update_project_agent',
  'list_agent_evaluations',
  'get_agent_evaluation',
  'list_agent_evaluation_runs',
  'get_agent_evaluation_run_results',
  'create_agent_evaluation',
  'update_agent_evaluation',
  'append_agent_evaluation_prompts',
  'run_agent_evaluation',
] as const;

export const AGENT_DEVELOPER_MCP_TOOL_NAMES = [
  ...AGENT_VIEWER_MCP_TOOL_NAMES,
  ...AGENT_DEVELOPER_ADDITIONAL_TOOL_SHORT_NAMES.map((shortName) => `${TOOL_PREFIX}${shortName}`),
];

export function registerAgentDeveloperTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerAgentViewerTools(server, contextProvider);

  registerValidateProjectTool(server, contextProvider);
  registerUpsertChartAsCodeTool(server, contextProvider);

  registerAiAgentopsPlanTool(server, contextProvider);
  registerAiAgentopsApplyTool(server, contextProvider);

  registerListProjectAgentsTool(server, contextProvider);
  registerGetProjectAgentTool(server, contextProvider);
  registerCreateProjectAgentTool(server, contextProvider);
  registerUpdateProjectAgentTool(server, contextProvider);

  registerListAgentEvaluationsTool(server, contextProvider);
  registerGetAgentEvaluationTool(server, contextProvider);
  registerListAgentEvaluationRunsTool(server, contextProvider);
  registerGetAgentEvaluationRunResultsTool(server, contextProvider);
  registerCreateAgentEvaluationTool(server, contextProvider);
  registerUpdateAgentEvaluationTool(server, contextProvider);
  registerAppendAgentEvaluationPromptsTool(server, contextProvider);
  registerRunAgentEvaluationTool(server, contextProvider);
}
