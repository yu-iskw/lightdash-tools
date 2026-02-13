/**
 * Charts (v1) command implementation.
 */

import type { Command } from 'commander';
import { readFileSync } from 'fs';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';
import type { UpsertChartAsCodeBody } from '@lightdash-tools/common';

/**
 * Reads JSON from stdin or a file (for chart-as-code upsert body).
 */
async function readChartJsonInput(filePath?: string): Promise<UpsertChartAsCodeBody> {
  if (filePath) {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as UpsertChartAsCodeBody;
  }
  return new Promise((resolve, reject) => {
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
        resolve(JSON.parse(input) as UpsertChartAsCodeBody);
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
 * Registers the projects charts subcommands under the existing projects command.
 */
export function registerChartsCommand(program: Command): void {
  const projectsCmd = program.commands.find((c) => c.name() === 'projects');
  if (!projectsCmd) {
    throw new Error('projects command must be registered before charts');
  }

  const chartsCmd = projectsCmd
    .command('charts')
    .description('List project charts and charts-as-code operations (v1)');

  chartsCmd
    .command('list <projectUuid>')
    .description('List charts in a project')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
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
      }),
    );

  const codeCmd = chartsCmd
    .command('code')
    .description('Charts as code (get list, upsert by slug)');

  codeCmd
    .command('list <projectUuid>')
    .description('Get charts in code representation')
    .option('--ids <ids...>', 'Filter by chart IDs (slugs)')
    .option('--offset <number>', 'Pagination offset', (v) => parseInt(v, 10))
    .option('--language-map', 'Include language map in response')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (
          projectUuid: string,
          options: { ids?: string[]; offset?: number; languageMap?: boolean },
        ) => {
          try {
            const client = getClient();
            const result = await client.v1.charts.getChartsAsCode(projectUuid, {
              ids: options.ids,
              offset: options.offset,
              languageMap: options.languageMap,
            });
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error getting charts as code:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );

  codeCmd
    .command('upsert <projectUuid> <slug>')
    .description('Upsert a chart from code (body from --file or stdin)')
    .option('--file <path>', 'Read chart JSON from file (default: stdin)')
    .action(
      wrapAction(
        WRITE_IDEMPOTENT,
        async (projectUuid: string, slug: string, options: { file?: string }) => {
          try {
            const body = await readChartJsonInput(options.file);
            const client = getClient();
            const result = await client.v1.charts.upsertChartAsCode(projectUuid, slug, body);
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error upserting chart as code:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
