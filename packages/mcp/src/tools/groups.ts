/**
 * MCP tools: groups (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

type ListGroupsParams = {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
};

export function registerGroupTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_groups',
    {
      title: 'List groups',
      description: 'List organization groups (one page)',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
        searchQuery: z.string().optional().describe('Search query'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async (params: ListGroupsParams) => {
      const result = await c.v1.groups.listGroups(params ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_group',
    {
      title: 'Get group',
      description: 'Get a group by UUID',
      inputSchema: { groupUuid: z.string().describe('Group UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ groupUuid }: { groupUuid: string }) => {
      const group = await c.v1.groups.getGroup(groupUuid);
      return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
    }),
  );
}
