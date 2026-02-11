/**
 * MCP tools: users / organization members (list, get, delete).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE } from './shared.js';

type ListMembersParams = {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
};

export function registerUserTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_organization_members',
    {
      title: 'List organization members',
      description: 'List organization members (one page)',
      inputSchema: {
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
        searchQuery: z.string().optional().describe('Search query'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async (params: ListMembersParams) => {
      const result = await c.v1.users.listMembers(params ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_member',
    {
      title: 'Get member',
      description: 'Get an organization member by UUID',
      inputSchema: { userUuid: z.string().describe('User UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ userUuid }: { userUuid: string }) => {
      const member = await c.v1.users.getMemberByUuid(userUuid);
      return { content: [{ type: 'text', text: JSON.stringify(member, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'delete_member',
    {
      title: 'Delete member (destructive)',
      description:
        'Permanently remove a user from the organization. Destructive; clients and agents should obtain explicit user confirmation before calling.',
      inputSchema: { userUuid: z.string().describe('User UUID') },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(client, (c) => async ({ userUuid }: { userUuid: string }) => {
      await c.v1.users.deleteMember(userUuid);
      return { content: [{ type: 'text', text: 'Member deleted.' }] };
    }),
  );
}
