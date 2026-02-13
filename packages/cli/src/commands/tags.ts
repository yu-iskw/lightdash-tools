/**
 * Tags command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the tags command and its subcommands.
 */
export function registerTagsCommand(program: Command): void {
  const tagsCmd = program.command('tags').description('Manage tags');

  tagsCmd
    .command('list <projectUuid>')
    .description('List tags in a project')
    .action(async (projectUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.tags.listTags(projectUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error listing tags:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  tagsCmd
    .command('get <projectUuid> <tagUuid>')
    .description('Get a tag by UUID')
    .action(async (projectUuid: string, tagUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.tags.getTag(projectUuid, tagUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error fetching tag:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
