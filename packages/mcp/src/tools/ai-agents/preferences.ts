/**
 * Read-only user AI-agent preference tools (ai-agent-chat profile).
 */

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import { optionalProjectUuidField, withAiAgentProjectScope } from './helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerGetUserAgentPreferences(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_user_agent_preferences',
    {
      title: 'Get user agent preferences',
      description:
        "Read the current user's per-project default AI agent (null when none is set). Read-only; this profile does not set or delete preferences.",
      inputSchema: { projectUuid: optionalProjectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid }: { projectUuid?: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.getUserAgentPreferences(scope.projectUuid),
          })),
    ),
  );
}

export const getUserAgentPreferencesTool = defineTool(
  'get_user_agent_preferences',
  registerGetUserAgentPreferences,
);
