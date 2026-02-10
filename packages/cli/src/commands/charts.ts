/**
 * Charts (v1) command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the projects charts subcommands under the existing projects command.
 */
export function registerChartsCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before charts');
  }

  const chartsCmd = projectsCmd.command('charts').description('List project charts (v1)');

  chartsCmd
    .command('list <projectUuid>')
    .description('List charts in a project')
    .action(async (projectUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.charts.listCharts(projectUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing charts:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
