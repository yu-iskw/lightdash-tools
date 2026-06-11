/**
 * Project-scoped AI agents command implementation.
 *
 * Covers: agent CRUD, thread management, and evaluation lifecycle.
 * All commands require --project <projectUuid>.
 */

import { registerAgentsCrudCommands } from './agents-crud';
import { registerAgentsEvalCommands } from './agents-evals';
import { registerAgentsThreadCommands } from './agents-threads';

import type { Command } from 'commander';

/**
 * Registers the `agents` command group (project-scoped).
 */
export function registerAgentsCommand(program: Command): void {
  const agentsCmd = program
    .command('agents')
    .description('Manage AI agents within a project (project-scoped)');

  registerAgentsCrudCommands(agentsCmd);
  registerAgentsThreadCommands(agentsCmd);
  registerAgentsEvalCommands(agentsCmd);
}
