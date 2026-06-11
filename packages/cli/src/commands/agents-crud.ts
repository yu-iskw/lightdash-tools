/**
 * Agent CRUD commands (list, get, create, update, delete).
 */

import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE, WRITE_IDEMPOTENT } from '@lightdash-tools/common';

import { getClient } from '../utils/client';
import { readParsedInput } from '../utils/file-input';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';

function hasFileInput(options: { file?: string; stdin?: boolean }): boolean {
  return options.file != null || options.stdin === true || !process.stdin.isTTY;
}

/**
 * Registers agent CRUD subcommands on the `agents` command group.
 */
export function registerAgentsCrudCommands(agentsCmd: Command): void {
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
    .option('--name <name>', 'Agent name')
    .option('--description <text>', 'Agent description')
    .option('--instruction <text>', 'System instruction for the agent')
    .option('--file <path>', 'Read agent JSON/YAML from file')
    .option('--stdin', 'Read agent JSON/YAML from stdin')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async function (this: Command) {
        const options = this.opts() as {
          project: string;
          name?: string;
          description?: string;
          instruction?: string;
          file?: string;
          stdin?: boolean;
        };
        try {
          const client = getClient();
          let body: Parameters<typeof client.v1.aiAgents.createAgent>[1];

          if (hasFileInput(options)) {
            const parsed = await readParsedInput({ file: options.file, stdin: options.stdin });
            if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              console.error('Error: agent input must be a JSON/YAML object');
              process.exit(1);
            }
            body = {
              ...(parsed as Record<string, unknown>),
              projectUuid: options.project,
            } as Parameters<typeof client.v1.aiAgents.createAgent>[1];
          } else {
            if (options.name == null) {
              console.error('Error: --name is required unless using --file or --stdin');
              process.exit(1);
            }
            body = {
              name: options.name,
              projectUuid: options.project,
              ...(options.description != null ? { description: options.description } : {}),
              ...(options.instruction != null ? { instruction: options.instruction } : {}),
            } as Parameters<typeof client.v1.aiAgents.createAgent>[1];
          }

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
    .option('--file <path>', 'Read agent patch JSON/YAML from file')
    .option('--stdin', 'Read agent patch JSON/YAML from stdin')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (agentUuid: string, cmd: Command) => {
        const options = cmd.opts() as {
          project: string;
          name?: string;
          description?: string;
          instruction?: string;
          file?: string;
          stdin?: boolean;
        };
        try {
          const client = getClient();
          let body: Parameters<typeof client.v1.aiAgents.updateAgent>[2];

          if (hasFileInput(options)) {
            const parsed = await readParsedInput({ file: options.file, stdin: options.stdin });
            if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              console.error('Error: agent patch input must be a JSON/YAML object');
              process.exit(1);
            }
            body = parsed as Parameters<typeof client.v1.aiAgents.updateAgent>[2];
          } else {
            const patch: Record<string, unknown> = {};
            if (options.name != null) patch['name'] = options.name;
            if (options.description != null) patch['description'] = options.description;
            if (options.instruction != null) patch['instruction'] = options.instruction;
            if (Object.keys(patch).length === 0) {
              console.error(
                'Error: at least one of --name, --description, --instruction, --file, --stdin is required',
              );
              process.exit(1);
            }
            body = patch as Parameters<typeof client.v1.aiAgents.updateAgent>[2];
          }

          const result = await client.v1.aiAgents.updateAgent(
            options.project,
            agentUuid,
            body,
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
}
