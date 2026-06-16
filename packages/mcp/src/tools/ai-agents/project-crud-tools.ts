/**
 * MCP tools: project-scoped AI agent CRUD.
 */

import { z } from 'zod';

import { projectUuidField } from '../schema-fields.js';
import {
  jsonToolResult,
  READ_ONLY_CAPABILITY,
  READ_ONLY_DEFAULT,
  registerToolSafe,
  wrapToolAnnotated,
  WRITE_DESTRUCTIVE,
  WRITE_DESTRUCTIVE_CAPABILITY,
  WRITE_IDEMPOTENT,
  WRITE_IDEMPOTENT_CAPABILITY,
} from '../shared.js';

import type { McpContextProvider } from '../../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerListProjectAgentsTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
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
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          const result = await c.v1.aiAgents.listAgents(projectUuid);
          return jsonToolResult(result);
        },
    ),
  );
}

export function registerGetProjectAgentTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
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
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          const result = await c.v1.aiAgents.getAgent(projectUuid, agentUuid);
          return jsonToolResult(result);
        },
    ),
  );
}

export function registerCreateProjectAgentTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
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
    wrapToolAnnotated(
      contextProvider,
      WRITE_IDEMPOTENT_CAPABILITY,
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
}

export function registerUpdateProjectAgentTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
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
    wrapToolAnnotated(
      contextProvider,
      WRITE_IDEMPOTENT_CAPABILITY,
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
}

export function registerDeleteProjectAgentTool(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
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
    wrapToolAnnotated(
      contextProvider,
      WRITE_DESTRUCTIVE_CAPABILITY,
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

export function registerProjectAgentCrudTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerListProjectAgentsTool(server, contextProvider);
  registerGetProjectAgentTool(server, contextProvider);
  registerCreateProjectAgentTool(server, contextProvider);
  registerUpdateProjectAgentTool(server, contextProvider);
  registerDeleteProjectAgentTool(server, contextProvider);
}
