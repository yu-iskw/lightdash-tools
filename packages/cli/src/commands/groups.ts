/**
 * Groups command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the groups command and its subcommands.
 * Note: Uses HTTP client directly since GroupsClient doesn't exist yet.
 */
export function registerGroupsCommand(program: Command): void {
  const groupsCmd = program.command('groups').description('Manage groups');

  groupsCmd
    .command('list')
    .description('List all groups in the current organization')
    .action(async () => {
      try {
        const client = getClient();
        const http = client.getHttpClientV1();
        const groups = await http.get<unknown[]>('/org/groups');
        console.log(JSON.stringify(groups, null, 2));
      } catch (error) {
        console.error(
          'Error listing groups:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
