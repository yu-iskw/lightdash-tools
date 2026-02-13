/**
 * AI agents (v1) command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the top-level ai-agents command and its subcommands.
 */
export function registerAiAgentsCommand(program: Command): void {
  const aiAgentsCmd = program.command('ai-agents').description('Manage AI agents (admin, v1)');

  aiAgentsCmd
    .command('list')
    .description('List all AI agents (admin)')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async () => {
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.listAdminAgents();
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing AI agents:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  aiAgentsCmd
    .command('threads')
    .description('List AI agent threads (admin)')
    .option('--page <number>', 'Page number', (v: string) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v: string) => parseInt(v, 10))
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts() as { page?: number; pageSize?: number };
        try {
          const client = getClient();
          const params: { page?: number; pageSize?: number } = {};
          if (options.page != null) params.page = options.page;
          if (options.pageSize != null) params.pageSize = options.pageSize;
          const result = await client.v1.aiAgents.getAdminThreads(
            Object.keys(params).length > 0 ? params : undefined,
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing AI agent threads:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  aiAgentsCmd
    .command('settings')
    .description('Get AI organization settings')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async () => {
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.getAiOrganizationSettings();
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching AI organization settings:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
