/**
 * MCP tools: project-scoped AI agent CRUD.
 */

import { z } from 'zod';

import { projectUuidField } from '../schema-fields.js';
import {
  jsonToolResult,
  wrapTool,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from '../shared.js';

import type { McpContextProvider } from '../../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerProjectAgentCrudTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  // ─── Project-scoped: agent CRUD ──────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_project_agents',
    {
      title: 'List agents in a project',
      description: 'List all AI agents configured for a specific project',
      inputSchema: {
        projectUuid: projectUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.aiAgents.listAgents(projectUuid);
      return jsonToolResult(result);
    }),
  );

  registerToolSafe(
    server,
    'get_project_agent',
    {
      title: 'Get agent',
      description: 'Get details of a specific AI agent in a project',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          const result = await c.v1.aiAgents.getAgent(projectUuid, agentUuid);
          return jsonToolResult(result);
        },
    ),
  );

  registerToolSafe(
    server,
    'create_project_agent',
    {
      title: 'Create agent',
      description: 'Create a new AI agent in a project',
      inputSchema: {
        projectUuid: projectUuidField(),
        name: z.string().describe('Agent name'),
        description: z.string().optional().describe('Agent description'),
        instruction: z.string().optional().describe('System instruction for the agent'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          name,
          description,
          instruction,
        }: {
          projectUuid: string;
          name: string;
          description?: string;
          instruction?: string;
        }) => {
          const body = {
            name,
            projectUuid,
            ...(description != null ? { description } : {}),
            ...(instruction != null ? { instruction } : {}),
          } as Parameters<typeof c.v1.aiAgents.createAgent>[1];
          const result = await c.v1.aiAgents.createAgent(projectUuid, body);
          return jsonToolResult(result);
        },
    ),
  );

  registerToolSafe(
    server,
    'update_project_agent',
    {
      title: 'Update agent',
      description: 'Update an existing AI agent',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        name: z.string().optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        instruction: z.string().optional().describe('New system instruction'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          ...body
        }: {
          projectUuid: string;
          agentUuid: string;
          name?: string;
          description?: string;
          instruction?: string;
        }) => {
          const result = await c.v1.aiAgents.updateAgent(
            projectUuid,
            agentUuid,
            body as Parameters<typeof c.v1.aiAgents.updateAgent>[2],
          );
          return jsonToolResult(result);
        },
    ),
  );

  registerToolSafe(
    server,
    'delete_project_agent',
    {
      title: 'Delete agent',
      description: 'Delete an AI agent from a project',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          await c.v1.aiAgents.deleteAgent(projectUuid, agentUuid);
          return {
            content: [{ type: 'text', text: `Agent ${agentUuid} deleted successfully` }],
          };
        },
    ),
  );
}
