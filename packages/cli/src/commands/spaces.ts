/**
 * Spaces (v1) command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the projects spaces subcommands under the existing projects command.
 */
export function registerSpacesCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before spaces');
  }

  const spacesCmd = projectsCmd.command('spaces').description('Manage project spaces (v1)');

  spacesCmd
    .command('list <projectUuid>')
    .description('List spaces in a project')
    .action(async (projectUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.spaces.listSpacesInProject(projectUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing spaces:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  spacesCmd
    .command('get <projectUuid> <spaceUuid>')
    .description('Get a space by UUID')
    .action(async (projectUuid: string, spaceUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.spaces.getSpace(projectUuid, spaceUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error fetching space:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
