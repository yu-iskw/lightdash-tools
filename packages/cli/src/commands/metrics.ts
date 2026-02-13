/**
 * Metrics command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the metrics command and its subcommands.
 */
export function registerMetricsCommand(program: Command): void {
  const metricsCmd = program.command('metrics').description('Manage metrics');

  metricsCmd
    .command('list <projectUuid>')
    .description('List metrics in a project')
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
            const result = await client.v1.metrics.listMetrics(projectUuid, {
              search: options.search,
              page: options.page,
              pageSize: options.pageSize,
            });
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error listing metrics:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  metricsCmd
    .command('get <projectUuid> <tableName> <metricName>')
    .description('Get a metric by table and name')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (projectUuid: string, tableName: string, metricName: string) => {
          try {
            const client = getClient();
            const result = await client.v1.metrics.getMetric(projectUuid, tableName, metricName);
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error fetching metric:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
