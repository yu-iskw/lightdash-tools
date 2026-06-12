/**
 * MCP tools: users / organization members (list, get).
 * Irrecoverable ops (e.g. delete member) are client-only per ADR-0037.
 */

import { z } from 'zod';

import { userUuidField } from './schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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
      inputSchema: { userUuid: userUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ userUuid }: { userUuid: string }) => {
      const member = await c.v1.users.getMemberByUuid(userUuid);
      return { content: [{ type: 'text', text: JSON.stringify(member, null, 2) }] };
    }),
  );
}
