/**
 * MCP tools: explores (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerExploresTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_explores',
    {
      title: 'List explores',
      description: 'List all explores in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const explores = await c.v1.explores.listExplores(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(explores, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_explore',
    {
      title: 'Get explore',
      description: 'Get an explore by project UUID and explore ID',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        exploreId: z.string().describe('Explore ID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, exploreId }: { projectUuid: string; exploreId: string }) => {
          const explore = await c.v1.explores.getExplore(projectUuid, exploreId);
          return { content: [{ type: 'text', text: JSON.stringify(explore, null, 2) }] };
        },
    ),
  );
}
