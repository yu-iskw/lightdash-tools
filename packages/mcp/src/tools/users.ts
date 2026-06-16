/**
 * MCP tools: users / organization members (list, get).
 * Irrecoverable ops (e.g. delete member) are client-only per ADR-0037.
 */

import { z } from 'zod';

import { userUuidField } from './schema-fields.js';
import {
  READ_ONLY_CAPABILITY,
  READ_ONLY_DEFAULT,
  registerToolSafe,
  wrapToolAnnotated,
} from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ListMembersParams = {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
};

export function registerUserTools(server: McpServer, contextProvider: McpContextProvider): void {
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
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) => async (params: ListMembersParams) => {
        const result = await c.v1.users.listMembers(params ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    ),
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
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ userUuid }: { userUuid: string }) => {
          const member = await c.v1.users.getMemberByUuid(userUuid);
          return { content: [{ type: 'text', text: JSON.stringify(member, null, 2) }] };
        },
    ),
  );
  registerToolSafe(
    server,
    'get_authenticated_user',
    {
      title: 'Get authenticated user',
      description:
        'Return the Lightdash user associated with the current credentials (PAT or OAuth bearer token)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(contextProvider, READ_ONLY_CAPABILITY, (c) => async () => {
      const user = await c.v1.users.getAuthenticatedUser();
      const safe = {
        userUuid: user.userUuid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationUuid: user.organizationUuid,
        role: user.role,
      };
      return { content: [{ type: 'text', text: JSON.stringify(safe, null, 2) }] };
    }),
  );
}
