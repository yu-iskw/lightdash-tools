/**
 * MCP tools: project-scoped AI agent threads.
 */

import { z } from 'zod';

import { projectUuidField } from '../schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '../shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerProjectAgentThreadTools(server: McpServer, client: LightdashClient): void {
  // ─── Project-scoped: threads ─────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_agent_threads',
    {
      title: 'List agent threads',
      description: 'List all conversation threads for an agent',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          const result = await c.v1.aiAgents.listAgentThreads(projectUuid, agentUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'get_agent_thread',
    {
      title: 'Get agent thread',
      description: 'Get a conversation thread with all its messages',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        threadUuid: z.string().describe('Thread UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          threadUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          threadUuid: string;
        }) => {
          const result = await c.v1.aiAgents.getAgentThread(projectUuid, agentUuid, threadUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'generate_agent_message',
    {
      title: 'Generate agent message',
      description:
        'Start a new conversation thread and generate the first agent response for a given prompt',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        prompt: z.string().describe('User prompt to send to the agent'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          prompt,
        }: {
          projectUuid: string;
          agentUuid: string;
          prompt: string;
        }) => {
          const thread = await c.v1.aiAgents.createAgentThread(projectUuid, agentUuid);
          const result = await c.v1.aiAgents.generateAgentThreadResponse(
            projectUuid,
            agentUuid,
            thread.uuid,
            { prompt },
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ threadUuid: thread.uuid, ...result }, null, 2),
              },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'continue_agent_thread',
    {
      title: 'Continue agent thread',
      description: 'Continue an existing conversation thread with a new prompt',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        threadUuid: z.string().describe('Thread UUID to continue'),
        prompt: z.string().describe('Follow-up prompt'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          threadUuid,
          prompt,
        }: {
          projectUuid: string;
          agentUuid: string;
          threadUuid: string;
          prompt: string;
        }) => {
          const result = await c.v1.aiAgents.generateAgentThreadResponse(
            projectUuid,
            agentUuid,
            threadUuid,
            { prompt },
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
