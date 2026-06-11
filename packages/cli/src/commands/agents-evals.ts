/**
 * Agent evaluation commands.
 */

import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE, WRITE_IDEMPOTENT } from '@lightdash-tools/common';

import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';

/**
 * Registers the `agents evals` subcommand group.
 */
export function registerAgentsEvalCommands(agentsCmd: Command): void {
  const evalsCmd = agentsCmd
    .command('evals')
    .description('Manage agent evaluations and run test suites');

  evalsCmd
    .command('list <agentUuid>')
    .description('List all evaluations for an agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.listEvaluations(project, agentUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing evaluations:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('get <agentUuid> <evalUuid>')
    .description('Get a full evaluation including its prompts')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.getEvaluation(project, agentUuid, evalUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('create <agentUuid>')
    .description('Create a new evaluation with a title and optional prompts (JSON file)')
    .requiredOption('--project <uuid>', 'Project UUID')
    .requiredOption('--title <title>', 'Evaluation title')
    .option('--description <text>', 'Evaluation description')
    .option(
      '--prompts <json>',
      'JSON array of prompt objects: [{"prompt":"...","expectedResponse":"..."}]',
    )
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, cmd: Command) => {
        const options = cmd.opts() as {
          project: string;
          title: string;
          description?: string;
          prompts?: string;
        };
        try {
          const client = getClient();
          const body: Parameters<typeof client.v1.aiAgents.createEvaluation>[2] = {
            title: options.title,
            prompts: options.prompts ? (JSON.parse(options.prompts) as never) : [],
          };
          if (options.description != null) body.description = options.description;
          const result = await client.v1.aiAgents.createEvaluation(
            options.project,
            agentUuid,
            body,
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error creating evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('update <agentUuid> <evalUuid>')
    .description('Update an evaluation title, description, or prompts')
    .requiredOption('--project <uuid>', 'Project UUID')
    .option('--title <title>', 'New title')
    .option('--description <text>', 'New description')
    .option('--prompts <json>', 'Replacement JSON array of prompt objects')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const options = cmd.opts() as {
          project: string;
          title?: string;
          description?: string;
          prompts?: string;
        };
        const body: Record<string, unknown> = {};
        if (options.title != null) body['title'] = options.title;
        if (options.description != null) body['description'] = options.description;
        if (options.prompts != null) body['prompts'] = JSON.parse(options.prompts);
        if (Object.keys(body).length === 0) {
          console.error('Error: at least one of --title, --description, --prompts is required');
          process.exit(1);
        }
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.updateEvaluation(
            options.project,
            agentUuid,
            evalUuid,
            body as Parameters<typeof client.v1.aiAgents.updateEvaluation>[3],
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error updating evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('append <agentUuid> <evalUuid>')
    .description('Append additional prompts to an existing evaluation')
    .requiredOption('--project <uuid>', 'Project UUID')
    .requiredOption('--prompts <json>', 'JSON array of prompt objects to append')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const options = cmd.opts() as { project: string; prompts: string };
        try {
          const client = getClient();
          await client.v1.aiAgents.appendToEvaluation(options.project, agentUuid, evalUuid, {
            prompts: JSON.parse(options.prompts) as never,
          });
          console.error(`Prompts appended to evaluation ${evalUuid} successfully`);
        } catch (error) {
          console.error(
            'Error appending to evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('delete <agentUuid> <evalUuid>')
    .description('Delete an evaluation')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          await client.v1.aiAgents.deleteEvaluation(project, agentUuid, evalUuid);
          console.error(`Evaluation ${evalUuid} deleted successfully`);
        } catch (error) {
          console.error(
            'Error deleting evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('run <agentUuid> <evalUuid>')
    .description('Trigger a new evaluation run')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.runEvaluation(project, agentUuid, evalUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error running evaluation:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('runs <agentUuid> <evalUuid>')
    .description('List all runs for an evaluation')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, evalUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.listEvaluationRuns(project, agentUuid, evalUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing evaluation runs:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  evalsCmd
    .command('run-results <agentUuid> <evalUuid> <runUuid>')
    .description('Get detailed results for a specific evaluation run')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (agentUuid: string, evalUuid: string, runUuid: string, cmd: Command) => {
          const { project } = cmd.opts() as { project: string };
          try {
            const client = getClient();
            const result = await client.v1.aiAgents.getEvaluationRunResults(
              project,
              agentUuid,
              evalUuid,
              runUuid,
            );
            console.log(JSON.stringify(result, null, 2));
          } catch (error) {
            console.error(
              'Error fetching evaluation run results:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
