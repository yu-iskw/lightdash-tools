/**
 * MCP tools: groups (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import {
  wrapTool,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './shared.js';

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

  registerToolSafe(
    server,
    'create_group',
    {
      title: 'Create group',
      description: 'Create a new group in the organization',
      inputSchema: {
        name: z.string().describe('Group name'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(client, (c) => async ({ name }: { name: string }) => {
      const group = await c.v1.groups.createGroup({ name });
      return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'update_group',
    {
      title: 'Update group',
      description: 'Update a group name',
      inputSchema: {
        groupUuid: z.string().describe('Group UUID'),
        name: z.string().describe('New group name'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(client, (c) => async ({ groupUuid, name }: { groupUuid: string; name: string }) => {
      const group = await c.v1.groups.updateGroup(groupUuid, { name });
      return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'delete_group',
    {
      title: 'Delete group',
      description: 'Delete a group by UUID',
      inputSchema: {
        groupUuid: z.string().describe('Group UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(client, (c) => async ({ groupUuid }: { groupUuid: string }) => {
      await c.v1.groups.deleteGroup(groupUuid);
      return { content: [{ type: 'text', text: `Group ${groupUuid} deleted successfully` }] };
    }),
  );

  registerToolSafe(
    server,
    'list_group_members',
    {
      title: 'List group members',
      description: 'List members of a group',
      inputSchema: {
        groupUuid: z.string().describe('Group UUID'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ groupUuid }: { groupUuid: string }) => {
      const members = await c.v1.groups.getGroupMembers(groupUuid);
      return { content: [{ type: 'text', text: JSON.stringify(members, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'add_user_to_group',
    {
      title: 'Add user to group',
      description: 'Add a user to a group',
      inputSchema: {
        groupUuid: z.string().describe('Group UUID'),
        userUuid: z.string().describe('User UUID'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({ groupUuid, userUuid }: { groupUuid: string; userUuid: string }) => {
          await c.v1.groups.addUserToGroup(groupUuid, userUuid);
          return {
            content: [
              { type: 'text', text: `User ${userUuid} added to group ${groupUuid} successfully` },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'remove_user_from_group',
    {
      title: 'Remove user from group',
      description: 'Remove a user from a group',
      inputSchema: {
        groupUuid: z.string().describe('Group UUID'),
        userUuid: z.string().describe('User UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      client,
      (c) =>
        async ({ groupUuid, userUuid }: { groupUuid: string; userUuid: string }) => {
          await c.v1.groups.removeUserFromGroup(groupUuid, userUuid);
          return {
            content: [
              {
                type: 'text',
                text: `User ${userUuid} removed from group ${groupUuid} successfully`,
              },
            ],
          };
        },
    ),
  );
}
