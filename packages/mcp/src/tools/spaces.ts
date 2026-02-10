/**
 * MCP tools: spaces (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe } from './shared.js';

export function registerSpaceTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_spaces',
    {
      title: 'List spaces',
      description: 'List spaces in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const spaces = await c.v1.spaces.listSpacesInProject(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(spaces, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_space',
    {
      title: 'Get space',
      description: 'Get a space by project and space UUID',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        spaceUuid: z.string().describe('Space UUID'),
      },
    },
    wrapTool(
      client,
      (c) =>
        async ({ projectUuid, spaceUuid }: { projectUuid: string; spaceUuid: string }) => {
          const space = await c.v1.spaces.getSpace(projectUuid, spaceUuid);
          return { content: [{ type: 'text', text: JSON.stringify(space, null, 2) }] };
        },
    ),
  );
}
