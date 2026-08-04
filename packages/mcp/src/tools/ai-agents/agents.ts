/**
 * Project AI agent inventory tools (ai-agent-ops profile).
 */

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import { agentUuidField, optionalProjectUuidField, withAgentOpsScope } from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjectAgents(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_project_agents',
    {
      title: 'List project AI agents',
      description: 'List AI agents in the resolved project (project-scoped API).',
      inputSchema: { projectUuid: optionalProjectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid }: { projectUuid?: string }) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.listAgents(scope.projectUuid),
          })),
    ),
  );
}

export function registerGetProjectAgent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_project_agent',
    {
      title: 'Get project AI agent',
      description: 'Get a single AI agent configuration in the resolved project.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid?: string; agentUuid: string }) =>
          withAgentOpsScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getAgent(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

// ToolModule exports (profile mounts)
export const listProjectAgentsTool = defineTool('list_project_agents', registerListProjectAgents);
export const getProjectAgentTool = defineTool('get_project_agent', registerGetProjectAgent);
