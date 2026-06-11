/**
 * AgentOps CLI command group (RFC Phase 2).
 */

import { type Command } from 'commander';

import { registerAgentopsApplyCommand } from './agentops/apply';
import { registerAgentopsBundleSchemaCommand } from './agentops/bundle-schema';
import { registerAgentopsDriftCommand } from './agentops/drift';
import { registerAgentopsEvaluateGateCommand } from './agentops/evaluate-gate';
import { registerAgentopsGateSchemaCommand } from './agentops/gate-schema';
import { registerAgentopsPlanCommand } from './agentops/plan';

/**
 * Registers the top-level agentops command and subcommands.
 */
export function registerAgentopsCommand(program: Command): void {
  const agentopsCmd = program
    .command('agentops')
    .description('AgentOps workflows — bundle plan/apply/drift and evaluation gates');

  registerAgentopsPlanCommand(agentopsCmd);
  registerAgentopsApplyCommand(agentopsCmd);
  registerAgentopsDriftCommand(agentopsCmd);
  registerAgentopsEvaluateGateCommand(agentopsCmd);
  registerAgentopsBundleSchemaCommand(agentopsCmd);
  registerAgentopsGateSchemaCommand(agentopsCmd);
}
