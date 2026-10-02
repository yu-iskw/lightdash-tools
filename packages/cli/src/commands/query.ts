/**
 * Query command implementation.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { getClient } from '../utils/client';
import { readParsedInput } from '../utils/file-input';
import { wrapAction } from '../utils/safety';

import type { CompileQueryRequest } from '@lightdash-tools/common';
import type { Command } from 'commander';

/**
 * Registers the query command and its subcommands.
 */
export function registerQueryCommand(program: Command): void {
  const queryCmd = program.command('query').description('Query operations');

  queryCmd
    .command('compile')
    .description('Compile a metric query for an explore')
    .argument('<projectUuid>', 'Project UUID')
    .argument('<exploreId>', 'Explore ID')
    .option('--file <path>', 'Read metric query JSON from file (default: read from stdin)')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (projectUuid: string, exploreId: string, options: { file?: string }) => {
          try {
            const body = (await readParsedInput({ file: options.file })) as CompileQueryRequest;

            const client = getClient();
            const result = await client.v1.query.compileQuery(projectUuid, exploreId, body);
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error compiling query:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
