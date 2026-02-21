/**
 * AI agents (v1) command implementation — admin endpoints.
 */

import type { Command } from 'commander';
import type { GetAdminThreadsParams, UpdateAiOrganizationSettings } from '@lightdash-tools/common';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the top-level ai-agents command and its subcommands (admin scope).
 */
export function registerAiAgentsCommand(program: Command): void {
  const aiAgentsCmd = program
    .command('ai-agents')
    .description('Manage AI agents — admin endpoints (cross-project)');

  aiAgentsCmd
    .command('list')
    .description('List all AI agents across the organization (admin)')
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
    .description('List AI agent threads across the organization (admin)')
    .option('--page <number>', 'Page number', (v: string) => parseInt(v, 10))
    .option('--page-size <number>', 'Page size', (v: string) => parseInt(v, 10))
    .option('--agent <uuid>', 'Filter by agent UUID (repeatable)', (v, prev: string[]) => [
      ...(prev ?? []),
      v,
    ])
    .option('--project <uuid>', 'Filter by project UUID (repeatable)', (v, prev: string[]) => [
      ...(prev ?? []),
      v,
    ])
    .option('--human-score <number>', 'Filter by human score (-1, 0, or 1)', (v: string) =>
      parseInt(v, 10),
    )
    .option('--date-from <date>', 'Start date filter (YYYY-MM-DD)')
    .option('--date-to <date>', 'End date filter (YYYY-MM-DD)')
    .option('--sort <field>', 'Sort field: createdAt | title')
    .option('--sort-direction <dir>', 'Sort direction: asc | desc')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts() as {
          page?: number;
          pageSize?: number;
          agent?: string[];
          project?: string[];
          humanScore?: number;
          dateFrom?: string;
          dateTo?: string;
          sort?: string;
          sortDirection?: string;
        };
        try {
          const client = getClient();
          const params: GetAdminThreadsParams = {};
          if (options.page != null) params.page = options.page;
          if (options.pageSize != null) params.pageSize = options.pageSize;
          if (options.agent != null) params.agentUuids = options.agent;
          if (options.project != null) params.projectUuids = options.project;
          if (options.humanScore != null) params.humanScore = options.humanScore;
          if (options.dateFrom != null) params.dateFrom = options.dateFrom;
          if (options.dateTo != null) params.dateTo = options.dateTo;
          if (options.sort != null)
            params.sortField = options.sort as GetAdminThreadsParams['sortField'];
          if (options.sortDirection != null)
            params.sortDirection = options.sortDirection as 'asc' | 'desc';
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

  const settingsCmd = aiAgentsCmd
    .command('settings')
    .description('Manage AI organization settings');

  settingsCmd
    .command('get')
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

  settingsCmd
    .command('update')
    .description('Update AI organization settings')
    .option('--ai-agents-visible <bool>', 'Show/hide AI agents feature (true|false)')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async function (this: Command) {
        const options = this.opts() as { aiAgentsVisible?: string };
        const body: Partial<UpdateAiOrganizationSettings> = {};
        if (options.aiAgentsVisible != null) {
          if (options.aiAgentsVisible !== 'true' && options.aiAgentsVisible !== 'false') {
            console.error(
              `Error: --ai-agents-visible must be 'true' or 'false', got: '${options.aiAgentsVisible}'`,
            );
            process.exit(1);
          }
          (body as Record<string, unknown>)['aiAgentsVisible'] = options.aiAgentsVisible === 'true';
        }
        if (Object.keys(body).length === 0) {
          console.error('Error: at least one option is required (e.g. --ai-agents-visible)');
          process.exit(1);
        }
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.updateAiOrganizationSettings(
            body as UpdateAiOrganizationSettings,
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error updating AI organization settings:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
