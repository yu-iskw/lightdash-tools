/**
 * Dashboards (v1) command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the projects dashboards subcommands under the existing projects command.
 */
export function registerDashboardsCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before dashboards');
  }

  const dashboardsCmd = projectsCmd
    .command('dashboards')
    .description('List project dashboards (v1)');

  dashboardsCmd
    .command('list <projectUuid>')
    .description('List dashboards in a project')
    .action(async (projectUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.dashboards.listDashboards(projectUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing dashboards:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
