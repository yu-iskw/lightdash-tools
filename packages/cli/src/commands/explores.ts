/**
 * Explores (v1) command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the projects explores subcommands under the existing projects command.
 */
export function registerExploresCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before explores');
  }

  const exploresCmd = projectsCmd
    .command('explores')
    .description('List and get project explores (v1)');

  exploresCmd
    .command('list <projectUuid>')
    .description('List explores in a project')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
        try {
          const client = getClient();
          const result = await client.v1.explores.listExplores(projectUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing explores:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  exploresCmd
    .command('get <projectUuid> <exploreId>')
    .description('Get an explore by ID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string, exploreId: string) => {
        try {
          const client = getClient();
          const result = await client.v1.explores.getExplore(projectUuid, exploreId);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching explore:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  exploresCmd
    .command('dimensions <projectUuid> <exploreId>')
    .description('List dimensions for an explore')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string, exploreId: string) => {
        try {
          const client = getClient();
          const result = await client.v1.explores.listDimensions(projectUuid, exploreId);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing dimensions:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  exploresCmd
    .command('lineage <projectUuid> <exploreId> <fieldId>')
    .description('Get lineage for a field in an explore')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (projectUuid: string, exploreId: string, fieldId: string) => {
          try {
            const client = getClient();
            const result = await client.v1.explores.getFieldLineage(
              projectUuid,
              exploreId,
              fieldId,
            );
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error fetching lineage:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
