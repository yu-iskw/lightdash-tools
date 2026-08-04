/**
 * AI agent discovery tools (readiness, suggestions, models, explore access).
 */

import { z } from 'zod';

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import { agentUuidField, optionalProjectUuidField, withAgentOpsScope } from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

const READINESS_LIMITATION =
  'evaluate_agent_readiness calls the Lightdash readiness API only. It is not an evaluation-suite run and does not invoke the agent end-to-end.';

type AgentScopeArgs = { projectUuid?: string; agentUuid: string };

export function registerEvaluateAgentReadiness(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'evaluate_agent_readiness',
    {
      title: 'Evaluate agent readiness',
      description:
        'Call Lightdash evaluateReadiness for an agent. Not an evaluation-suite run; does not invoke the agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AgentScopeArgs) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.evaluateAgentReadiness(scope.projectUuid, agentUuid),
            mode: 'project_readiness_api',
            limitations: [READINESS_LIMITATION],
          })),
    ),
  );
}

export function registerGetAgentSuggestions(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_suggestions',
    {
      title: 'Get agent suggestions',
      description: 'List suggestion chips for an agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AgentScopeArgs) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getAgentSuggestions(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerGetAgentModels(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_models',
    {
      title: 'Get agent models',
      description: 'List available AI model options for an agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AgentScopeArgs) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getAgentModelOptions(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerGetExploreAccessSummary(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_explore_access_summary',
    {
      title: 'Get explore access summary',
      description:
        'Summarize explore access for tag-filtered explores (POST …/aiAgents/explore-access-summary). Project-scoped; no agentUuid.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        tags: z
          .array(z.string())
          .nullable()
          .optional()
          .describe('Tag filter; null/omit for untagged summary per API'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, tags }: { projectUuid?: string; tags?: string[] | null }) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getExploreAccessSummary(scope.projectUuid, {
              tags: tags === undefined ? null : tags,
            }),
          })),
    ),
  );
}

// ToolModule exports (profile mounts)
export const evaluateAgentReadinessTool = defineTool(
  'evaluate_agent_readiness',
  registerEvaluateAgentReadiness,
);
export const getAgentSuggestionsTool = defineTool(
  'get_agent_suggestions',
  registerGetAgentSuggestions,
);
export const getAgentModelsTool = defineTool('get_agent_models', registerGetAgentModels);
export const getExploreAccessSummaryTool = defineTool(
  'get_explore_access_summary',
  registerGetExploreAccessSummary,
);
