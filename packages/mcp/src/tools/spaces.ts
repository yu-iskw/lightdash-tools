/**
 * MCP tools: spaces (list, get).
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
import { type SpaceMemberRole } from '@lightdash-tools/common';

export function registerSpaceTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_spaces',
    {
      title: 'List spaces',
      description: 'List spaces in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
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
      annotations: READ_ONLY_DEFAULT,
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

  registerToolSafe(
    server,
    'grant_user_space_access',
    {
      title: 'Grant user access to space',
      description: 'Grant a user access to a space',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        spaceUuid: z.string().describe('Space UUID'),
        userUuid: z.string().describe('User UUID'),
        spaceRole: z.enum(['viewer', 'editor', 'admin']).describe('Space role'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          spaceUuid,
          userUuid,
          spaceRole,
        }: {
          projectUuid: string;
          spaceUuid: string;
          userUuid: string;
          spaceRole: string;
        }) => {
          await c.v1.spaces.grantUserAccessToSpace(projectUuid, spaceUuid, {
            userUuid,
            spaceRole: spaceRole as SpaceMemberRole,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Successfully granted ${spaceRole} access to user ${userUuid} in space ${spaceUuid}`,
              },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'revoke_user_space_access',
    {
      title: 'Revoke user access to space',
      description: "Revoke a user's access to a space",
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        spaceUuid: z.string().describe('Space UUID'),
        userUuid: z.string().describe('User UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          spaceUuid,
          userUuid,
        }: {
          projectUuid: string;
          spaceUuid: string;
          userUuid: string;
        }) => {
          await c.v1.spaces.revokeUserAccessToSpace(projectUuid, spaceUuid, userUuid);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully revoked access for user ${userUuid} in space ${spaceUuid}`,
              },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'grant_group_space_access',
    {
      title: 'Grant group access to space',
      description: 'Grant a group access to a space',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        spaceUuid: z.string().describe('Space UUID'),
        groupUuid: z.string().describe('Group UUID'),
        spaceRole: z.enum(['viewer', 'editor', 'admin']).describe('Space role'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          spaceUuid,
          groupUuid,
          spaceRole,
        }: {
          projectUuid: string;
          spaceUuid: string;
          groupUuid: string;
          spaceRole: string;
        }) => {
          await c.v1.spaces.grantGroupAccessToSpace(projectUuid, spaceUuid, {
            groupUuid,
            spaceRole: spaceRole as SpaceMemberRole,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Successfully granted ${spaceRole} access to group ${groupUuid} in space ${spaceUuid}`,
              },
            ],
          };
        },
    ),
  );

  registerToolSafe(
    server,
    'revoke_group_space_access',
    {
      title: 'Revoke group access to space',
      description: "Revoke a group's access to a space",
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        spaceUuid: z.string().describe('Space UUID'),
        groupUuid: z.string().describe('Group UUID'),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          spaceUuid,
          groupUuid,
        }: {
          projectUuid: string;
          spaceUuid: string;
          groupUuid: string;
        }) => {
          await c.v1.spaces.revokeGroupAccessToSpace(projectUuid, spaceUuid, groupUuid);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully revoked access for group ${groupUuid} in space ${spaceUuid}`,
              },
            ],
          };
        },
    ),
  );
}
