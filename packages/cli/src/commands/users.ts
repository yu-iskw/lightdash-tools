/**
 * Users command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the users command and its subcommands.
 * Note: Uses HTTP client directly since UsersClient doesn't exist yet.
 */
export function registerUsersCommand(program: Command): void {
  const usersCmd = program.command('users').description('Manage users');

  usersCmd
    .command('list')
    .description('List all users in the current organization')
    .action(async () => {
      try {
        const client = getClient();
        const http = client.getHttpClientV1();
        const users = await http.get<unknown[]>('/org/users');
        console.log(JSON.stringify(users, null, 2));
      } catch (error) {
        console.error(
          'Error listing users:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
