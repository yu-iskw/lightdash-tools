/**
 * Organization roles (v2) command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the organization roles subcommands under the existing organization command.
 * Resolves org UUID via getCurrentOrganization().organizationUuid.
 */
export function registerOrganizationRolesCommand(program: Command): void {
  const orgCmd = program.commands.find((c) => c.name() === 'organization');
  if (!orgCmd) {
    throw new Error('organization command must be registered before organization-roles');
  }

  const rolesCmd = orgCmd.command('roles').description('Manage organization roles (v2)');

  rolesCmd
    .command('list')
    .description('List organization roles')
    .option('--load <value>', 'Load query param')
    .option('--role-type-filter <value>', 'Filter by role type')
    .action(async function (this: Command) {
      const options = this.opts() as { load?: string; roleTypeFilter?: string };
      try {
        const client = getClient();
        const org = await client.v1.organizations.getCurrentOrganization();
        const orgUuid = (org as { organizationUuid: string }).organizationUuid;
        const params =
          options.load != null || options.roleTypeFilter != null
            ? { load: options.load, roleTypeFilter: options.roleTypeFilter }
            : undefined;
        const result = await client.v2.organizationRoles.getRoles(orgUuid, params);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing organization roles:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  rolesCmd
    .command('get <roleUuid>')
    .description('Get an organization role by UUID')
    .action(async (roleUuid: string) => {
      try {
        const client = getClient();
        const org = await client.v1.organizations.getCurrentOrganization();
        const orgUuid = (org as { organizationUuid: string }).organizationUuid;
        const role = await client.v2.organizationRoles.getRole(orgUuid, roleUuid);
        console.log(JSON.stringify(role, null, 2));
      } catch (error) {
        console.error(
          'Error fetching organization role:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  const assignmentsCmd = rolesCmd
    .command('assignments')
    .description('Organization role assignments');
  assignmentsCmd
    .command('list')
    .description('List organization role assignments')
    .action(async () => {
      try {
        const client = getClient();
        const org = await client.v1.organizations.getCurrentOrganization();
        const orgUuid = (org as { organizationUuid: string }).organizationUuid;
        const result = await client.v2.organizationRoles.listRoleAssignments(orgUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing role assignments:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  rolesCmd
    .command('assign <userUuid>')
    .description('Assign an organization role to a user')
    .requiredOption('--role-id <roleId>', 'Role ID to assign')
    .action(async (userUuid: string, cmd: Command) => {
      const options = cmd.opts() as { roleId: string };
      try {
        const client = getClient();
        const org = await client.v1.organizations.getCurrentOrganization();
        const orgUuid = (org as { organizationUuid: string }).organizationUuid;
        const result = await client.v2.organizationRoles.assignRoleToUser(orgUuid, userUuid, {
          roleId: options.roleId,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error assigning role to user:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
