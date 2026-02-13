/**
 * Project access (v1) command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the projects access subcommands under the existing projects command.
 */
export function registerProjectAccessCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before project-access');
  }

  const accessCmd = projectsCmd.command('access').description('Manage project access (v1)');

  accessCmd
    .command('list <projectUuid>')
    .description('List users with project access')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v1.projectAccess.listProjectAccess(projectUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing project access:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  const groupsCmd = accessCmd.command('groups').description('Project group access');
  groupsCmd
    .command('list <projectUuid>')
    .description('List group access for a project')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v1.projectAccess.listProjectGroupAccesses(projectUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing project group access:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  accessCmd
    .command('get <projectUuid> <userUuid>')
    .description('Get a project member access')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string, userUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v1.projectAccess.getProjectMemberAccess(
            projectUuid,
            userUuid,
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching project member access:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
