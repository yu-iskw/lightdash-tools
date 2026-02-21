/**
 * Project-scoped AI agents command implementation.
 *
 * Covers: agent CRUD, thread management, and evaluation lifecycle.
 * All commands require --project <projectUuid>.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the `agents` command group (project-scoped).
 */
export function registerAgentsCommand(program: Command): void {
  const agentsCmd = program
    .command('agents')
    .description('Manage AI agents within a project (project-scoped)');

  // ─── Agent CRUD ──────────────────────────────────────────────────────────────

  agentsCmd
    .command('list')
    .description('List all agents in a project')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const { project } = this.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.listAgents(project);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing agents:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('get <agentUuid>')
    .description('Get a single agent by UUID')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.getAgent(project, agentUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching agent:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('create')
    .description('Create a new agent in a project')
    .requiredOption('--project <uuid>', 'Project UUID')
    .requiredOption('--name <name>', 'Agent name')
    .option('--description <text>', 'Agent description')
    .option('--instruction <text>', 'System instruction for the agent')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async function (this: Command) {
        const options = this.opts() as {
          project: string;
          name: string;
          description?: string;
          instruction?: string;
        };
        try {
          const client = getClient();
          const body = {
            name: options.name,
            projectUuid: options.project,
            ...(options.description != null ? { description: options.description } : {}),
            ...(options.instruction != null ? { instruction: options.instruction } : {}),
          } as Parameters<typeof client.v1.aiAgents.createAgent>[1];
          const result = await client.v1.aiAgents.createAgent(options.project, body);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error creating agent:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('update <agentUuid>')
    .description('Update an existing agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .option('--name <name>', 'New agent name')
    .option('--description <text>', 'New agent description')
    .option('--instruction <text>', 'New system instruction')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, cmd: Command) => {
        const options = cmd.opts() as {
          project: string;
          name?: string;
          description?: string;
          instruction?: string;
        };
        const body: Record<string, unknown> = {};
        if (options.name != null) body['name'] = options.name;
        if (options.description != null) body['description'] = options.description;
        if (options.instruction != null) body['instruction'] = options.instruction;
        if (Object.keys(body).length === 0) {
          console.error('Error: at least one of --name, --description, --instruction is required');
          process.exit(1);
        }
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.updateAgent(
            options.project,
            agentUuid,
            body as Parameters<typeof client.v1.aiAgents.updateAgent>[2],
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error updating agent:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('delete <agentUuid>')
    .description('Delete an agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          await client.v1.aiAgents.deleteAgent(project, agentUuid);
          console.error(`Agent ${agentUuid} deleted successfully`);
        } catch (error) {
          console.error(
            'Error deleting agent:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  // ─── Thread management ───────────────────────────────────────────────────────

  const threadsCmd = agentsCmd.command('threads').description('Manage agent conversation threads');

  threadsCmd
    .command('list <agentUuid>')
    .description('List all threads for an agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.listAgentThreads(project, agentUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing threads:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  threadsCmd
    .command('get <agentUuid> <threadUuid>')
    .description('Get a thread with all its messages')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, threadUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.getAgentThread(project, agentUuid, threadUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching thread:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  threadsCmd
    .command('generate <agentUuid>')
    .description('Start a new thread and generate the first agent response')
    .requiredOption('--project <uuid>', 'Project UUID')
    .requiredOption('--prompt <text>', 'User prompt')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, cmd: Command) => {
        const options = cmd.opts() as { project: string; prompt: string };
        try {
          const client = getClient();
          // 1. Create thread
          const thread = await client.v1.aiAgents.createAgentThread(options.project, agentUuid);
          // 2. Generate response
          const result = await client.v1.aiAgents.generateAgentThreadResponse(
            options.project,
            agentUuid,
            thread.uuid,
            { prompt: options.prompt },
          );
          console.log(JSON.stringify({ threadUuid: thread.uuid, ...result }, null, 2));
        } catch (error) {
          console.error(
            'Error generating agent response:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  threadsCmd
    .command('continue <agentUuid> <threadUuid>')
    .description('Continue an existing thread with a new prompt')
    .requiredOption('--project <uuid>', 'Project UUID')
    .requiredOption('--prompt <text>', 'User prompt')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, threadUuid: string, cmd: Command) => {
        const options = cmd.opts() as { project: string; prompt: string };
        try {
          const client = getClient();
          const result = await client.v1.aiAgents.generateAgentThreadResponse(
            options.project,
            agentUuid,
            threadUuid,
            { prompt: options.prompt },
          );
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error continuing thread:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  // ─── Evaluations ─────────────────────────────────────────────────────────────

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
