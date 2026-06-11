/**
 * Agent thread management commands.
 */

import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '@lightdash-tools/common';

import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';

/**
 * Registers the `agents threads` subcommand group.
 */
export function registerAgentsThreadCommands(agentsCmd: Command): void {
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
}
