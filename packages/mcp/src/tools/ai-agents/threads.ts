/**
 * AI agent thread read tools (ai-agent-ops and ai-agent-chat profiles).
 */

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import {
  agentUuidField,
  includeMessageTextField,
  optionalProjectUuidField,
  redactThreadMessages,
  redactThreadSummaries,
  threadUuidField,
  withAiAgentProjectScope,
} from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

type AgentScopeArgs = { projectUuid?: string; agentUuid: string };

export function registerListAgentThreads(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_agent_threads',
    {
      title: 'List agent threads',
      description:
        'List conversation thread summaries for an agent. firstMessage text is redacted unless includeMessageText=true.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        includeMessageText: includeMessageTextField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          includeMessageText,
        }: AgentScopeArgs & { includeMessageText?: boolean }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const threads = await c.v1.aiAgents.listAgentThreads(scope.projectUuid, agentUuid);
            return redactThreadSummaries(threads, includeMessageText === true);
          }),
    ),
  );
}

export function registerGetAgentThread(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_thread',
    {
      title: 'Get agent thread',
      description:
        'Get a conversation thread. Message bodies and firstMessage text are redacted unless includeMessageText=true.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        threadUuid: threadUuidField(),
        includeMessageText: includeMessageTextField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          threadUuid,
          includeMessageText,
        }: AgentScopeArgs & { threadUuid: string; includeMessageText?: boolean }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const thread = await c.v1.aiAgents.getAgentThread(
              scope.projectUuid,
              agentUuid,
              threadUuid,
            );
            return redactThreadMessages(thread, includeMessageText === true);
          }),
    ),
  );
}

// ToolModule exports (profile mounts)
export const listAgentThreadsTool = defineTool('list_agent_threads', registerListAgentThreads);
export const getAgentThreadTool = defineTool('get_agent_thread', registerGetAgentThread);
