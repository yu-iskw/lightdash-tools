/**
 * MCP tools: AI agents (admin + project-scoped), threads, and evaluations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import {
  wrapTool,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './shared.js';

export function registerAiAgentTools(server: McpServer, client: LightdashClient): void {
  // ─── Admin: agents ───────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_admin_agents',
    {
      title: 'List AI agents (admin)',
      description: 'List all AI agents across the organization (admin view)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async () => {
      const result = await c.v1.aiAgents.listAdminAgents();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  // ─── Admin: threads ──────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_admin_agent_threads',
    {
      title: 'List AI agent threads (admin)',
      description:
        'List AI agent conversation threads across the organization with optional filters',
      inputSchema: {
        page: z.number().optional().describe('Page number (1-based)'),
        pageSize: z.number().optional().describe('Number of results per page'),
        agentUuids: z.array(z.string()).optional().describe('Filter by agent UUIDs'),
        projectUuids: z.array(z.string()).optional().describe('Filter by project UUIDs'),
        humanScore: z
          .number()
          .optional()
          .describe('Filter by human score: -1 (negative), 0 (neutral), 1 (positive)'),
        dateFrom: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
        dateTo: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
        sortField: z.enum(['createdAt', 'title']).optional().describe('Sort field'),
        sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async (params: {
          page?: number;
          pageSize?: number;
          agentUuids?: string[];
          projectUuids?: string[];
          humanScore?: number;
          dateFrom?: string;
          dateTo?: string;
          sortField?: 'createdAt' | 'title';
          sortDirection?: 'asc' | 'desc';
        }) => {
          const result = await c.v1.aiAgents.getAdminThreads(params);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  // ─── Admin: settings ─────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'get_ai_organization_settings',
    {
      title: 'Get AI organization settings',
      description: 'Get the AI settings for the current organization (admin)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async () => {
      const result = await c.v1.aiAgents.getAiOrganizationSettings();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'update_ai_organization_settings',
    {
      title: 'Update AI organization settings',
      description: 'Update the AI settings for the current organization (admin)',
      inputSchema: {
        aiAgentsVisible: z
          .boolean()
          .optional()
          .describe('Whether AI agents feature is visible to users'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(client, (c) => async (params: { aiAgentsVisible?: boolean }) => {
      const result = await c.v1.aiAgents.updateAiOrganizationSettings(
        params as Parameters<typeof c.v1.aiAgents.updateAiOrganizationSettings>[0],
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  // ─── Project-scoped: agent CRUD ──────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_project_agents',
    {
      title: 'List agents in a project',
      description: 'List all AI agents configured for a specific project',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.aiAgents.listAgents(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'get_project_agent',
    {
      title: 'Get agent',
      description: 'Get details of a specific AI agent in a project',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          const result = await c.v1.aiAgents.getAgent(projectUuid, agentUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
        projectUuid: z.string().describe('Project UUID'),
        name: z.string().describe('Agent name'),
        description: z.string().optional().describe('Agent description'),
        instruction: z.string().optional().describe('System instruction for the agent'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
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
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        name: z.string().optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        instruction: z.string().optional().describe('New system instruction'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
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
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          await c.v1.aiAgents.deleteAgent(projectUuid, agentUuid);
          return {
            content: [{ type: 'text', text: `Agent ${agentUuid} deleted successfully` }],
          };
        },
    ),
  );

  // ─── Project-scoped: threads ─────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_agent_threads',
    {
      title: 'List agent threads',
      description: 'List all conversation threads for an agent',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
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
        projectUuid: z.string().describe('Project UUID'),
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
        projectUuid: z.string().describe('Project UUID'),
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
        projectUuid: z.string().describe('Project UUID'),
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

  // ─── Project-scoped: evaluations ─────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_agent_evaluations',
    {
      title: 'List agent evaluations',
      description: 'List all evaluations for an agent',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, agentUuid }: { projectUuid: string; agentUuid: string }) => {
          const result = await c.v1.aiAgents.listEvaluations(projectUuid, agentUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'get_agent_evaluation',
    {
      title: 'Get agent evaluation',
      description: 'Get a full evaluation including its test prompts',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
        }) => {
          const result = await c.v1.aiAgents.getEvaluation(projectUuid, agentUuid, evalUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'create_agent_evaluation',
    {
      title: 'Create agent evaluation',
      description:
        'Create a new evaluation test suite for an agent with a title and optional prompts',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        title: z.string().describe('Evaluation title'),
        description: z.string().optional().describe('Evaluation description'),
        prompts: z
          .array(
            z.union([
              z.object({
                prompt: z.string().describe('Test prompt text'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
              z.object({
                threadUuid: z.string().describe('Existing thread UUID'),
                promptUuid: z.string().describe('Existing prompt UUID within the thread'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
            ]),
          )
          .optional()
          .describe('Test prompts for the evaluation'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          title,
          description,
          prompts,
        }: {
          projectUuid: string;
          agentUuid: string;
          title: string;
          description?: string;
          prompts?: Parameters<typeof c.v1.aiAgents.createEvaluation>[2]['prompts'];
        }) => {
          const body: Parameters<typeof c.v1.aiAgents.createEvaluation>[2] = {
            title,
            prompts: prompts ?? [],
            ...(description != null ? { description } : {}),
          };
          const result = await c.v1.aiAgents.createEvaluation(projectUuid, agentUuid, body);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'update_agent_evaluation',
    {
      title: 'Update agent evaluation',
      description: 'Update an evaluation title, description, or replace its prompts',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        prompts: z
          .array(
            z.union([
              z.object({
                prompt: z.string().describe('Test prompt text'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
              z.object({
                threadUuid: z.string().describe('Existing thread UUID'),
                promptUuid: z.string().describe('Existing prompt UUID within the thread'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
            ]),
          )
          .optional()
          .describe('Replacement prompt list (omit to leave unchanged)'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          ...body
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
          title?: string;
          description?: string;
          prompts?: Parameters<typeof c.v1.aiAgents.updateEvaluation>[3]['prompts'];
        }) => {
          const result = await c.v1.aiAgents.updateEvaluation(
            projectUuid,
            agentUuid,
            evalUuid,
            body as Parameters<typeof c.v1.aiAgents.updateEvaluation>[3],
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'append_agent_evaluation_prompts',
    {
      title: 'Append evaluation prompts',
      description:
        'Append additional prompts to an existing evaluation without replacing existing ones',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        prompts: z
          .array(
            z.union([
              z.object({
                prompt: z.string().describe('Test prompt text'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
              z.object({
                threadUuid: z.string().describe('Existing thread UUID'),
                promptUuid: z.string().describe('Existing prompt UUID within the thread'),
                expectedResponse: z.string().nullable().describe('Expected response (optional)'),
              }),
            ]),
          )
          .describe('Prompts to append'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          prompts,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
          prompts: Parameters<typeof c.v1.aiAgents.appendToEvaluation>[3]['prompts'];
        }) => {
          await c.v1.aiAgents.appendToEvaluation(projectUuid, agentUuid, evalUuid, { prompts });
          return {
            content: [
              { type: 'text', text: `Prompts appended to evaluation ${evalUuid} successfully` },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'run_agent_evaluation',
    {
      title: 'Run agent evaluation',
      description: 'Trigger a new evaluation run for an agent. Returns the run UUID and status.',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID to run'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
        }) => {
          const result = await c.v1.aiAgents.runEvaluation(projectUuid, agentUuid, evalUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'list_agent_evaluation_runs',
    {
      title: 'List evaluation runs',
      description: 'List all runs for an evaluation with their status and pass/fail counts',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
        }) => {
          const result = await c.v1.aiAgents.listEvaluationRuns(projectUuid, agentUuid, evalUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'get_agent_evaluation_run_results',
    {
      title: 'Get evaluation run results',
      description:
        'Get detailed per-prompt results for a specific evaluation run, including pass/fail and assessments',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        runUuid: z.string().describe('Run UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          runUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
          runUuid: string;
        }) => {
          const result = await c.v1.aiAgents.getEvaluationRunResults(
            projectUuid,
            agentUuid,
            evalUuid,
            runUuid,
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  registerToolSafe(
    server,
    'delete_agent_evaluation',
    {
      title: 'Delete agent evaluation',
      description: 'Delete an evaluation and all its runs',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
        }: {
          projectUuid: string;
          agentUuid: string;
          evalUuid: string;
        }) => {
          await c.v1.aiAgents.deleteEvaluation(projectUuid, agentUuid, evalUuid);
          return {
            content: [{ type: 'text', text: `Evaluation ${evalUuid} deleted successfully` }],
          };
        },
    ),
  );
}
