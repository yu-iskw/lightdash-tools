/**
 * Project role assignments (v2) command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the projects roles subcommands under the existing projects command.
 */
export function registerProjectRoleAssignmentsCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before project-role-assignments');
  }

  const rolesCmd = projectsCmd.command('roles').description('Manage project role assignments (v2)');

  rolesCmd
    .command('list <projectUuid>')
    .description('List project role assignments')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v2.projectRoleAssignments.listAssignments(projectUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing project role assignments:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  const assignCmd = rolesCmd.command('assign').description('Assign role to user or group');
  assignCmd
    .command('user <projectUuid> <userUuid>')
    .description('Assign a role to a user in a project')
    .requiredOption('--role-id <roleId>', 'Role ID to assign')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (projectUuid: string, userUuid: string, cmd: Command) => {
        const opts = cmd.opts() as { roleId: string };
        try {
          const client = getClient();
          const result = await client.v2.projectRoleAssignments.upsertUserAssignment(
            projectUuid,
            userUuid,
            { roleId: opts.roleId },
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error assigning role to user:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  assignCmd
    .command('group <projectUuid> <groupId>')
    .description('Assign a role to a group in a project')
    .requiredOption('--role-id <roleId>', 'Role ID to assign')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (projectUuid: string, groupId: string, cmd: Command) => {
        const opts = cmd.opts() as { roleId: string };
        try {
          const client = getClient();
          const result = await client.v2.projectRoleAssignments.upsertGroupAssignment(
            projectUuid,
            groupId,
            { roleId: opts.roleId },
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error assigning role to group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  const unassignCmd = rolesCmd.command('unassign').description('Remove role assignment');
  unassignCmd
    .command('user <projectUuid> <userUuid>')
    .description('Remove role assignment from a user')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (projectUuid: string, userUuid: string) => {
        try {
          const client = getClient();
          await client.v2.projectRoleAssignments.deleteUserAssignment(projectUuid, userUuid);
          console.log(JSON.stringify({ ok: true }, null, 2));
        } catch (error) {
          console.error(
            'Error removing user role assignment:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  unassignCmd
    .command('group <projectUuid> <groupId>')
    .description('Remove role assignment from a group')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (projectUuid: string, groupId: string) => {
        try {
          const client = getClient();
          await client.v2.projectRoleAssignments.deleteGroupAssignment(projectUuid, groupId);
          console.log(JSON.stringify({ ok: true }, null, 2));
        } catch (error) {
          console.error(
            'Error removing group role assignment:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
