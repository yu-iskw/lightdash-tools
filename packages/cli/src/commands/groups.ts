/**
 * Groups command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the groups command and its subcommands.
 * Uses client.v1.groups (typed client) per ADR-0010 and OpenSpec cli-parity-with-client.
 */
export function registerGroupsCommand(program: Command): void {
  const groupsCmd = program.command('groups').description('Manage groups');

  groupsCmd
    .command('list')
    .description('List all groups in the current organization')
    .option('--all', 'Fetch all pages and output the full list')
    .option('--page <number>', 'Page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v: string) => parseInt(v, 10))
    .option('--search <query>', 'Search query')
    .option('--include-members <number>', 'Include members (0 or 1)', (v: string) =>
      parseInt(v, 10),
    )
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts() as {
          all?: boolean;
          page?: number;
          pageSize?: number;
          search?: string;
          includeMembers?: number;
        };
        try {
          const client = getClient();
          if (options.all) {
            const listParams: { searchQuery?: string; includeMembers?: number } = {};
            if (options.search != null) listParams.searchQuery = options.search;
            if (options.includeMembers != null) listParams.includeMembers = options.includeMembers;
            const list = await client.v1.groups.listAllGroups(
              Object.keys(listParams).length > 0 ? listParams : undefined,
            );
            console.log(JSON.stringify(list, null, 2));
          } else {
            const params: {
              page?: number;
              pageSize?: number;
              searchQuery?: string;
              includeMembers?: number;
            } = {};
            if (options.page != null) params.page = options.page;
            if (options.pageSize != null) params.pageSize = options.pageSize;
            if (options.search != null) params.searchQuery = options.search;
            if (options.includeMembers != null) params.includeMembers = options.includeMembers;
            const result = await client.v1.groups.listGroups(
              Object.keys(params).length > 0 ? params : undefined,
            );
            console.log(JSON.stringify(result, null, 2));
          }
        } catch (error) {
          console.error(
            'Error listing groups:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  groupsCmd
    .command('get <groupUuid>')
    .description('Get a group by UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (groupUuid: string) => {
        try {
          const client = getClient();
          const group = await client.v1.groups.getGroup(groupUuid);
          console.log(JSON.stringify(group, null, 2));
        } catch (error) {
          console.error(
            'Error fetching group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  groupsCmd
    .command('create <name>')
    .description('Create a new group')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (name: string) => {
        try {
          const client = getClient();
          const group = await client.v1.groups.createGroup({ name });
          console.log(JSON.stringify(group, null, 2));
        } catch (error) {
          console.error(
            'Error creating group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  groupsCmd
    .command('update <groupUuid>')
    .description('Update a group')
    .option('--name <name>', 'New name for the group')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (groupUuid: string, cmd: Command) => {
        const options = cmd.opts() as { name?: string };
        if (!options.name) {
          console.error('Error: --name is required for update');
          process.exit(1);
        }
        try {
          const client = getClient();
          const group = await client.v1.groups.updateGroup(groupUuid, { name: options.name });
          console.log(JSON.stringify(group, null, 2));
        } catch (error) {
          console.error(
            'Error updating group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  groupsCmd
    .command('delete <groupUuid>')
    .description('Delete a group')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (groupUuid: string) => {
        try {
          const client = getClient();
          await client.v1.groups.deleteGroup(groupUuid);
          console.error(`Group ${groupUuid} deleted successfully`);
        } catch (error) {
          console.error(
            'Error deleting group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  const membersCmd = groupsCmd.command('members').description('Manage group members');

  membersCmd
    .command('list <groupUuid>')
    .description('List members of a group')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (groupUuid: string) => {
        try {
          const client = getClient();
          const members = await client.v1.groups.getGroupMembers(groupUuid);
          console.log(JSON.stringify(members, null, 2));
        } catch (error) {
          console.error(
            'Error listing group members:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  membersCmd
    .command('add <groupUuid> <userUuid>')
    .description('Add a user to a group')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (groupUuid: string, userUuid: string) => {
        try {
          const client = getClient();
          await client.v1.groups.addUserToGroup(groupUuid, userUuid);
          console.error(`User ${userUuid} added to group ${groupUuid} successfully`);
        } catch (error) {
          console.error(
            'Error adding user to group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  membersCmd
    .command('remove <groupUuid> <userUuid>')
    .description('Remove a user from a group')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (groupUuid: string, userUuid: string) => {
        try {
          const client = getClient();
          await client.v1.groups.removeUserFromGroup(groupUuid, userUuid);
          console.error(`User ${userUuid} removed from group ${groupUuid} successfully`);
        } catch (error) {
          console.error(
            'Error removing user from group:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
