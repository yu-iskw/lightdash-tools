/**
 * AI-agent conversation write tools (ai-agent-chat profile, ADR-0029).
 *
 * Hosts orchestrate create thread → create message → generate. Do not wrap /stream.
 */

import { WRITE_NONDESTRUCTIVE, WRITE_OPEN_WORLD } from '@lightdash-tools/common';
import { z } from 'zod';

import { registerToolSafe, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import {
  agentUuidField,
  optionalProjectUuidField,
  threadUuidField,
  withAiAgentProjectScope,
} from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

/** Conservative local prompt ceiling; not env-configurable in v1 (ADR-0029). */
export const THREAD_PROMPT_MAX_CHARS = 32_000;

/** Generation can exceed the client 30s default; keep a bounded timeout. */
export const GENERATE_AGENT_RESPONSE_TIMEOUT_MS = 180_000;

export const threadPromptField = (): z.ZodString =>
  z
    .string()
    .trim()
    .min(1)
    .max(THREAD_PROMPT_MAX_CHARS)
    .describe('User prompt to store on the thread (not sent to /generate)');

type AgentScopeArgs = { projectUuid?: string; agentUuid: string };
type ThreadScopeArgs = AgentScopeArgs & { threadUuid: string };

export function registerCreateAgentThread(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_agent_thread',
    {
      title: 'Create agent thread',
      description:
        'Create an empty conversation thread for an accessible AI agent. Sends {}. Non-idempotent — do not retry blindly after an ambiguous network failure.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AgentScopeArgs) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.createAgentThread(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerCreateAgentThreadMessage(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_agent_thread_message',
    {
      title: 'Create agent thread message',
      description:
        'Add a user prompt to an accessible thread. Does not invoke the managed agent. Non-idempotent — do not retry create after an ambiguous failure; retry generate instead if the message already exists.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        threadUuid: threadUuidField(),
        prompt: threadPromptField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          threadUuid,
          prompt,
        }: ThreadScopeArgs & { prompt: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.createAgentThreadMessage(
              scope.projectUuid,
              agentUuid,
              threadUuid,
              { prompt },
            ),
          })),
    ),
  );
}

export function registerGenerateAgentResponse(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'generate_agent_response',
    {
      title: 'Generate agent response',
      description:
        'Ask Lightdash to generate the managed AI-agent reply for the latest pending user message (POST …/generate, not /stream). Non-idempotent — do not call twice because the first response is slow. Open-world: the selected agent may query the warehouse and invoke tools configured on that agent in Lightdash; this is not a read-only operation. Nested tool authority is not enforced by this MCP profile. Do not pass SQL-mode flags.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        threadUuid: threadUuidField(),
      },
      annotations: WRITE_OPEN_WORLD,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid, threadUuid }: ThreadScopeArgs) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.generateAgentThreadResponse(
              scope.projectUuid,
              agentUuid,
              threadUuid,
              { timeoutMs: GENERATE_AGENT_RESPONSE_TIMEOUT_MS },
            ),
            mode: 'lightdash_ai_agent_generate',
            limitations: [
              'Uses POST …/generate (non-streaming), not /stream. SQL mode, autoApproveSql, and toolHints are not accepted.',
              'Generation is open-world: nested Lightdash-agent tools may have side effects.',
              'Non-idempotent: do not retry create_agent_thread or create_agent_thread_message after an ambiguous failure; retry generate only if the user message already exists.',
            ],
          })),
    ),
  );
}

export const createAgentThreadTool = defineTool('create_agent_thread', registerCreateAgentThread);
export const createAgentThreadMessageTool = defineTool(
  'create_agent_thread_message',
  registerCreateAgentThreadMessage,
);
export const generateAgentResponseTool = defineTool(
  'generate_agent_response',
  registerGenerateAgentResponse,
);
