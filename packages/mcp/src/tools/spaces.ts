/**
 * MCP tools: spaces (list, get).
 */

import { type SpaceMemberRole } from '@lightdash-tools/common';
import { z } from 'zod';

import {
  groupUuidField,
  projectUuidField,
  spaceUuidField,
  userUuidField,
} from './schema-fields.js';
import {
  wrapTool,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';



export function registerSpaceTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_spaces',
    {
      title: 'List spaces',
      description: 'List spaces in a project',
      inputSchema: { projectUuid: projectUuidField() },
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
        projectUuid: projectUuidField(),
        spaceUuid: spaceUuidField(),
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
        projectUuid: projectUuidField(),
        spaceUuid: spaceUuidField(),
        userUuid: userUuidField(),
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
        projectUuid: projectUuidField(),
        spaceUuid: spaceUuidField(),
        userUuid: userUuidField(),
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
        projectUuid: projectUuidField(),
        spaceUuid: spaceUuidField(),
        groupUuid: groupUuidField(),
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
        projectUuid: projectUuidField(),
        spaceUuid: spaceUuidField(),
        groupUuid: groupUuidField(),
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
