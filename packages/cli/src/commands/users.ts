/**
 * Users command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the users command and its subcommands.
 * Uses client.v1.users (typed client) per ADR-0010 and OpenSpec cli-parity-with-client.
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
    .action(async function (this: Command) {
      const options = this.opts() as {
        all?: boolean;
        page?: number;
        pageSize?: number;
        search?: string;
      };
      try {
        const client = getClient();
        if (options.all) {
          const listParams: { searchQuery?: string } = {};
          if (options.search != null) listParams.searchQuery = options.search;
          const list = await client.v1.users.listAllMembers(
            Object.keys(listParams).length > 0 ? listParams : undefined,
          );
          console.log(JSON.stringify(list, null, 2));
        } else {
          const params: { page?: number; pageSize?: number; searchQuery?: string } = {};
          if (options.page != null) params.page = options.page;
          if (options.pageSize != null) params.pageSize = options.pageSize;
          if (options.search != null) params.searchQuery = options.search;
          const result = await client.v1.users.listMembers(
            Object.keys(params).length > 0 ? params : undefined,
          );
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error) {
        console.error(
          'Error listing users:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  usersCmd
    .command('get <userUuid>')
    .description('Get a user by UUID')
    .action(async (userUuid: string) => {
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
    });
}
