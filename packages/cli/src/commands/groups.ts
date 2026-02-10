/**
 * Groups command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

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
    .action(async function (this: Command) {
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
    });

  groupsCmd
    .command('get <groupUuid>')
    .description('Get a group by UUID')
    .action(async (groupUuid: string) => {
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
    });
}
