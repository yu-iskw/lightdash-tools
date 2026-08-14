/**
 * Users command implementation.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { pickDefined } from '../utils/cli-params';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

import type { LightdashClient } from '@lightdash-tools/client';
import type { Command } from 'commander';

type ListUsersCliOptions = {
  all?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
};

async function listUsers(client: LightdashClient, options: ListUsersCliOptions): Promise<void> {
  const searchQuery = options.search;

  if (options.all) {
    const list = await client.v1.users.listAllMembers(pickDefined({ searchQuery }));
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  const result = await client.v1.users.listMembers(
    pickDefined({ page: options.page, pageSize: options.pageSize, searchQuery }),
  );
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Registers the users command and its subcommands.
 * Uses client.v1.users (typed client) per ADR-0010.
 */
export function registerUsersCommand(program: Command): void {
  const usersCmd = program.command('users').description('Manage users');

  usersCmd
    .command('list')
    .description('List all users in the current organization')
    .option('--all', 'Fetch all pages and output the full list')
    .option('--page <number>', 'Page number (1-based)', (v: string) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v: string) => parseInt(v, 10))
    .option('--search <query>', 'Search query')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts();
        try {
          await listUsers(getClient(), options);
        } catch (error) {
          console.error(
            'Error listing users:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  usersCmd
    .command('get <userUuid>')
    .description('Get a user by UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (userUuid: string) => {
        try {
          const client = getClient();
          const member = await client.v1.users.getMemberByUuid(userUuid);
          console.log(JSON.stringify(member, null, 2));
        } catch (error) {
          console.error(
            'Error fetching user:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
