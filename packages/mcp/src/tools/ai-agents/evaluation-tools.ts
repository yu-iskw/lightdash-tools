/**
 * MCP tools: project-scoped AI agent evaluations.
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
  WRITE_NONDESTRUCTIVE,
  WRITE_NONDESTRUCTIVE_CAPABILITY,
} from '../shared.js';

import type { McpContextProvider } from '../../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

const evaluationPromptInputSchema = z.union([
  z.object({
    prompt: z.string().describe('Test prompt text'),
    expectedResponse: z.string().nullable().describe('Expected response (optional)'),
  }),
  z.object({
    threadUuid: z.string().describe('Existing thread UUID'),
    promptUuid: z.string().describe('Existing prompt UUID within the thread'),
    expectedResponse: z.string().nullable().describe('Expected response (optional)'),
  }),
]);

function registerEvaluationReadTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_agent_evaluations',
    {
      title: 'List agent evaluations',
      description: 'List all evaluations for an agent',
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
          const result = await c.v1.aiAgents.listEvaluations(projectUuid, agentUuid);
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
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
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
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
          const result = await c.v1.aiAgents.listAllEvaluationRuns(
            projectUuid,
            agentUuid,
            evalUuid,
          );
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        runUuid: z.string().describe('Run UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
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
          return jsonToolResult(result);
        },
    ),
  );
}

function registerEvaluationWriteTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_agent_evaluation',
    {
      title: 'Create agent evaluation',
      description:
        'Create a new evaluation test suite for an agent with a title and optional prompts',
      inputSchema: {
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        title: z.string().describe('Evaluation title'),
        description: z.string().optional().describe('Evaluation description'),
        prompts: z
          .array(evaluationPromptInputSchema)
          .optional()
          .describe('Test prompts for the evaluation'),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapToolAnnotated(
      contextProvider,
      WRITE_NONDESTRUCTIVE_CAPABILITY,
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
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        prompts: z
          .array(evaluationPromptInputSchema)
          .optional()
          .describe('Replacement prompt list (omit to leave unchanged)'),
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
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
        prompts: z.array(evaluationPromptInputSchema).describe('Prompts to append'),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapToolAnnotated(
      contextProvider,
      WRITE_NONDESTRUCTIVE_CAPABILITY,
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
          const result = await c.v1.aiAgents.appendToEvaluation(projectUuid, agentUuid, evalUuid, {
            prompts,
          });
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID to run'),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapToolAnnotated(
      contextProvider,
      WRITE_NONDESTRUCTIVE_CAPABILITY,
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
          return jsonToolResult(result);
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
        projectUuid: projectUuidField(),
        agentUuid: z.string().describe('Agent UUID'),
        evalUuid: z.string().describe('Evaluation UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapToolAnnotated(
      contextProvider,
      WRITE_DESTRUCTIVE_CAPABILITY,
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
            structuredContent: { evalUuid, deleted: true },
          };
        },
    ),
  );
}

export function registerProjectAgentEvaluationTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerEvaluationReadTools(server, contextProvider);
  registerEvaluationWriteTools(server, contextProvider);
}
