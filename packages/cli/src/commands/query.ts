/**
 * Query command implementation.
 */

import type { Command } from 'commander';
import { readFileSync } from 'fs';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';
import type { CompileQueryRequest } from '@lightdash-tools/common';

/**
 * Reads JSON from stdin or a file.
 */
async function readJsonInput(filePath?: string): Promise<unknown> {
  if (filePath) {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
  // Read from stdin
  return new Promise((resolve, reject) => {
    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      reject(new Error('No input provided. Use --file <path> or pipe JSON to stdin.'));
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    process.stdin.on('end', () => {
      try {
        const input = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(input));
      } catch (err) {
        reject(
          new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`),
        );
      }
    });
    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}

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
            if (!projectUuid) {
              console.error('Error: projectUuid is required');
              process.exit(1);
            }
            if (!exploreId) {
              console.error('Error: exploreId is required');
              process.exit(1);
            }

            // Read JSON input
            const body = (await readJsonInput(options.file)) as CompileQueryRequest;

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
