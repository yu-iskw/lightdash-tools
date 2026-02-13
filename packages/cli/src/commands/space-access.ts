/**
 * Space access (v1) command implementation.
 */

import type { Command } from 'commander';
import { WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE, type SpaceMemberRole } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the space access subcommands under the existing projects command.
 */
export function registerSpaceAccessCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before space-access');
  }

  const spaceAccessCmd = projectsCmd
    .command('space-access')
    .description('Manage space access (v1)');

  const userCmd = spaceAccessCmd.command('user').description('Manage user access to a space');

  userCmd
    .command('grant <projectUuid> <spaceUuid> <userUuid> <role>')
    .description('Grant a user access to a space')
    .action(
      wrapAction(
        WRITE_IDEMPOTENT,
        async (projectUuid: string, spaceUuid: string, userUuid: string, role: string) => {
          try {
            const client = getClient();
            await client.v1.spaces.grantUserAccessToSpace(projectUuid, spaceUuid, {
              userUuid,
              spaceRole: role as SpaceMemberRole,
            });
            console.error(
              `Successfully granted ${role} access to user ${userUuid} in space ${spaceUuid}`,
            );
          } catch (error) {
            console.error(
              'Error granting user access to space:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  userCmd
    .command('revoke <projectUuid> <spaceUuid> <userUuid>')
    .description("Revoke a user's access to a space")
    .action(
      wrapAction(
        WRITE_DESTRUCTIVE,
        async (projectUuid: string, spaceUuid: string, userUuid: string) => {
          try {
            const client = getClient();
            await client.v1.spaces.revokeUserAccessToSpace(projectUuid, spaceUuid, userUuid);
            console.error(`Successfully revoked access for user ${userUuid} in space ${spaceUuid}`);
          } catch (error) {
            console.error(
              'Error revoking user access from space:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  const groupCmd = spaceAccessCmd.command('group').description('Manage group access to a space');

  groupCmd
    .command('grant <projectUuid> <spaceUuid> <groupUuid> <role>')
    .description('Grant a group access to a space')
    .action(
      wrapAction(
        WRITE_IDEMPOTENT,
        async (projectUuid: string, spaceUuid: string, groupUuid: string, role: string) => {
          try {
            const client = getClient();
            await client.v1.spaces.grantGroupAccessToSpace(projectUuid, spaceUuid, {
              groupUuid,
              spaceRole: role as SpaceMemberRole,
            });
            console.error(
              `Successfully granted ${role} access to group ${groupUuid} in space ${spaceUuid}`,
            );
          } catch (error) {
            console.error(
              'Error granting group access to space:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  groupCmd
    .command('revoke <projectUuid> <spaceUuid> <groupUuid>')
    .description("Revoke a group's access to a space")
    .action(
      wrapAction(
        WRITE_DESTRUCTIVE,
        async (projectUuid: string, spaceUuid: string, groupUuid: string) => {
          try {
            const client = getClient();
            await client.v1.spaces.revokeGroupAccessToSpace(projectUuid, spaceUuid, groupUuid);
            console.error(
              `Successfully revoked access for group ${groupUuid} in space ${spaceUuid}`,
            );
          } catch (error) {
            console.error(
              'Error revoking group access from space:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
