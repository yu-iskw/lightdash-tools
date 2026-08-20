/**
 * AI agent evaluation suite/run tools (ai-agent-ops profile).
 */

import { WRITE_DESTRUCTIVE, WRITE_NONDESTRUCTIVE, WRITE_OPEN_WORLD } from '@lightdash-tools/common';
import { z } from 'zod';

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import {
  agentUuidField,
  evaluationPromptsField,
  evalUuidField,
  includePromptTextField,
  optionalProjectUuidField,
  redactEvalRunResults,
  redactEvaluationPayload,
  runUuidField,
  withAiAgentProjectScope,
} from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type {
  AppendEvaluationBody,
  CreateEvaluationBody,
  UpdateEvaluationBody,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type ScopeArgs = { projectUuid?: string; agentUuid: string };

export function registerListAgentEvaluations(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_agent_evaluations',
    {
      title: 'List agent evaluations',
      description: 'List evaluation suites for an agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: ScopeArgs) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.listEvaluations(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerGetAgentEvaluation(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_evaluation',
    {
      title: 'Get agent evaluation',
      description:
        'Get a full evaluation suite. Prompt text is redacted unless includePromptText=true.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
        includePromptText: includePromptTextField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          includePromptText,
        }: ScopeArgs & { evalUuid: string; includePromptText?: boolean }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const evaluation = await c.v1.aiAgents.getEvaluation(
              scope.projectUuid,
              agentUuid,
              evalUuid,
            );
            return redactEvaluationPayload(evaluation, includePromptText === true);
          }),
    ),
  );
}

export function registerCreateAgentEvaluation(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_agent_evaluation',
    {
      title: 'Create agent evaluation',
      description: 'Create a Lightdash evaluation suite for an agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        title: z.string().min(1).describe('Evaluation title'),
        description: z.string().optional(),
        prompts: evaluationPromptsField(),
        includePromptText: includePromptTextField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          title,
          description,
          prompts,
          includePromptText,
        }: ScopeArgs & {
          title: string;
          description?: string;
          prompts: CreateEvaluationBody['prompts'];
          includePromptText?: boolean;
        }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const evaluation = await c.v1.aiAgents.createEvaluation(scope.projectUuid, agentUuid, {
              title,
              description,
              prompts,
            });
            return redactEvaluationPayload(evaluation, includePromptText === true);
          }),
    ),
  );
}

export function registerUpdateAgentEvaluation(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'update_agent_evaluation',
    {
      title: 'Update agent evaluation',
      description: 'Update evaluation title, description, or prompts.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        prompts: evaluationPromptsField().optional(),
        includePromptText: includePromptTextField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          title,
          description,
          prompts,
          includePromptText,
        }: ScopeArgs & {
          evalUuid: string;
          title?: string;
          description?: string;
          prompts?: UpdateEvaluationBody['prompts'];
          includePromptText?: boolean;
        }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const evaluation = await c.v1.aiAgents.updateEvaluation(
              scope.projectUuid,
              agentUuid,
              evalUuid,
              { title, description, prompts },
            );
            return redactEvaluationPayload(evaluation, includePromptText === true);
          }),
    ),
  );
}

export function registerAppendAgentEvaluationPrompts(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'append_agent_evaluation_prompts',
    {
      title: 'Append evaluation prompts',
      description: 'Append prompts to an existing evaluation suite.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
        prompts: evaluationPromptsField(),
        includePromptText: includePromptTextField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          prompts,
          includePromptText,
        }: ScopeArgs & {
          evalUuid: string;
          prompts: AppendEvaluationBody['prompts'];
          includePromptText?: boolean;
        }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const evaluation = await c.v1.aiAgents.appendToEvaluation(
              scope.projectUuid,
              agentUuid,
              evalUuid,
              { prompts },
            );
            return redactEvaluationPayload(evaluation, includePromptText === true);
          }),
    ),
  );
}

export function registerDeleteAgentEvaluation(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'delete_agent_evaluation',
    {
      title: 'Delete agent evaluation',
      description: 'Delete an evaluation suite and its runs.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid, evalUuid }: ScopeArgs & { evalUuid: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            await c.v1.aiAgents.deleteEvaluation(scope.projectUuid, agentUuid, evalUuid);
            return { data: { deleted: true, evalUuid } };
          }),
    ),
  );
}

export function registerRunAgentEvaluation(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'run_agent_evaluation',
    {
      title: 'Run agent evaluation',
      description:
        'Trigger a Lightdash evaluation run (open-world: may invoke the agent / warehouse). Poll with list/get run tools. Not a readiness API call.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
      },
      annotations: WRITE_OPEN_WORLD,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid, evalUuid }: ScopeArgs & { evalUuid: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.runEvaluation(scope.projectUuid, agentUuid, evalUuid),
            mode: 'lightdash_agent_evaluation_run',
            limitations: [
              'This triggers a product evaluation run. Promotion gates remain CLI agentops evaluate-gate.',
            ],
          })),
    ),
  );
}

export function registerListAgentEvaluationRuns(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_agent_evaluation_runs',
    {
      title: 'List evaluation runs',
      description: 'List runs for an evaluation suite (paginated).',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          page,
          pageSize,
        }: ScopeArgs & { evalUuid: string; page?: number; pageSize?: number }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.listEvaluationRuns(scope.projectUuid, agentUuid, evalUuid, {
              page,
              pageSize,
            }),
          })),
    ),
  );
}

export function registerGetAgentEvalRunResults(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_eval_run_results',
    {
      title: 'Get evaluation run results',
      description:
        'Get detailed per-prompt results for an evaluation run. Prompt text is redacted unless includePromptText=true. Does not compute CLI promotion gates.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        evalUuid: evalUuidField(),
        runUuid: runUuidField(),
        includePromptText: includePromptTextField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          evalUuid,
          runUuid,
          includePromptText,
        }: ScopeArgs & { evalUuid: string; runUuid: string; includePromptText?: boolean }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const run = await c.v1.aiAgents.getEvaluationRunResults(
              scope.projectUuid,
              agentUuid,
              evalUuid,
              runUuid,
            );
            const redacted = redactEvalRunResults(run, includePromptText === true);
            return {
              ...redacted,
              limitations: [
                'Promotion gates are evaluated via CLI agentops evaluate-gate, not this tool.',
              ],
            };
          }),
    ),
  );
}

// ToolModule exports (profile mounts)
export const listAgentEvaluationsTool = defineTool(
  'list_agent_evaluations',
  registerListAgentEvaluations,
);
export const getAgentEvaluationTool = defineTool(
  'get_agent_evaluation',
  registerGetAgentEvaluation,
);
export const createAgentEvaluationTool = defineTool(
  'create_agent_evaluation',
  registerCreateAgentEvaluation,
);
export const updateAgentEvaluationTool = defineTool(
  'update_agent_evaluation',
  registerUpdateAgentEvaluation,
);
export const appendAgentEvaluationPromptsTool = defineTool(
  'append_agent_evaluation_prompts',
  registerAppendAgentEvaluationPrompts,
);
export const deleteAgentEvaluationTool = defineTool(
  'delete_agent_evaluation',
  registerDeleteAgentEvaluation,
);
export const runAgentEvaluationTool = defineTool(
  'run_agent_evaluation',
  registerRunAgentEvaluation,
);
export const listAgentEvaluationRunsTool = defineTool(
  'list_agent_evaluation_runs',
  registerListAgentEvaluationRuns,
);
export const getAgentEvalRunResultsTool = defineTool(
  'get_agent_eval_run_results',
  registerGetAgentEvalRunResults,
);
