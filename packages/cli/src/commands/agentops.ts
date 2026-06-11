/**
 * AgentOps CLI command group (RFC Phase 2).
 */

import { readFileSync } from 'node:fs';

import { Command } from 'commander';

import { registerAgentopsApplyCommand } from './agentops/apply';
import { registerAgentopsBundleSchemaCommand } from './agentops/bundle-schema';
import { registerAgentopsDriftCommand } from './agentops/drift';
import { registerAgentopsEvaluateGateCommand } from './agentops/evaluate-gate';
import { registerAgentopsGateSchemaCommand } from './agentops/gate-schema';
import { registerAgentopsPlanCommand } from './agentops/plan';

/**
 * Reads YAML from --file or stdin (when --stdin is set or stdin is piped).
 */
export async function readYamlInput(options: {
  file?: string;
  stdin?: boolean;
}): Promise<string> {
  if (options.file) {
    return readFileSync(options.file, 'utf-8');
  }
  if (options.stdin === true || !process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      process.stdin.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      process.stdin.on('error', reject);
    });
  }
  throw new Error('No input provided. Use --file <path> or --stdin to read from stdin.');
}

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
