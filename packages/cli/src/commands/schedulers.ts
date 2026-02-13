/**
 * Schedulers command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the schedulers command and its subcommands.
 */
export function registerSchedulersCommand(program: Command): void {
  const schedulersCmd = program.command('schedulers').description('Manage scheduled deliveries');

  schedulersCmd
    .command('list <projectUuid>')
    .description('List schedulers in a project')
    .option('--search <query>', 'Search query')
    .option('--page <number>', 'Page number', (v) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v) => parseInt(v, 10))
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (
          projectUuid: string,
          options: { search?: string; page?: number; pageSize?: number },
        ) => {
          try {
            const client = getClient();
            const result = await client.v1.schedulers.listSchedulers(projectUuid, {
              searchQuery: options.search,
              page: options.page,
              pageSize: options.pageSize,
            });
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error listing schedulers:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  schedulersCmd
    .command('get <schedulerUuid>')
    .description('Get a scheduler by UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (schedulerUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v1.schedulers.getScheduler(schedulerUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching scheduler:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
