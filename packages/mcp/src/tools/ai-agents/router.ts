/**
 * AI Router selection tool (ai-agent-chat profile).
 *
 * Wraps POST /api/v1/org/aiRouter/route. Returns a routing decision for
 * create_agent_thread → generate_agent_response. Does not activate Data MCP
 * session agent context (ADR-0031). Upstream persists a router decision row
 * (including the prompt), so this is not a read-only annotation.
 */

import { WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';

import { registerToolSafe, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import { optionalProjectUuidField, threadPromptField, withAiAgentProjectScope } from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerRouteAgent(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'route_agent',
    {
      title: 'Route prompt to best AI agent',
      description:
        'Ask the org AI Router which accessible managed AI agent should answer this prompt (POST …/org/aiRouter/route). Returns nextAction, suggestedAgentUuid, confidence, candidates, and reasoning. Host must still create_agent_thread then generate_agent_response — this does not start a conversation or activate Data MCP session agent context. When nextAction is show_picker, ask the user; do not invent a pick from instruction text. Persists a router decision upstream (not read-only).',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        prompt: threadPromptField('User prompt to route (same text used for create when routing)'),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, prompt }: { projectUuid?: string; prompt: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.routeAiAgent({
              projectUuid: scope.projectUuid,
              prompt,
            }),
          })),
    ),
  );
}

export const routeAgentTool = defineTool('route_agent', registerRouteAgent);
