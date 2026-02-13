/**
 * Content command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the content command and its subcommands.
 */
export function registerContentCommand(program: Command): void {
  const contentCmd = program.command('content').description('Manage project content');

  contentCmd
    .command('search <query>')
    .description('Search project content (charts, dashboards, spaces)')
    .option('--project <uuids...>', 'Filter by project UUIDs')
    .option('--type <types...>', 'Filter by content types (chart, dashboard, space)')
    .option('--page <number>', 'Page number', (v) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v) => parseInt(v, 10))
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (
          query: string,
          options: {
            project?: string[];
            type?: ('chart' | 'dashboard' | 'space')[];
            page?: number;
            pageSize?: number;
          },
        ) => {
          try {
            const client = getClient();
            const result = await client.v2.content.searchContent({
              search: query,
              projectUuids: options.project,
              contentTypes: options.type,
              page: options.page,
              pageSize: options.pageSize,
            });
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error searching content:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
