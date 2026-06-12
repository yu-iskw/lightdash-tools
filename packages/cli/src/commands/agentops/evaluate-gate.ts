/**
 * agentops evaluate-gate — evaluate an evaluation gate policy against a run.
 */

import { resolveEvaluationRun } from '@lightdash-tools/client';
import {
  GateExitCode,
  WRITE_OPEN_WORLD,
  evaluateGatePolicy,
  formatGateJUnit,
  formatGateMarkdown,
  formatGateTimeoutJUnit,
  formatGateTimeoutMarkdown,
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { readExplicitFileOrStdin } from '../../utils/file-input';
import { assertAllowedProject, wrapAction } from '../../utils/safety';

import type { Command } from 'commander';

function parsePositiveSeconds(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

export function registerAgentopsEvaluateGateCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('evaluate-gate')
    .description('Evaluate an evaluation gate policy against a run')
    .option('--file <path>', 'Path to gate YAML file')
    .option('--stdin', 'Read gate YAML from stdin')
    .option('--wait', 'Wait for the evaluation run to complete', false)
    .option(
      '--timeout <seconds>',
      'Wait timeout in seconds',
      (v: string) => parsePositiveSeconds(v, '--timeout'),
      600,
    )
    .option(
      '--poll-interval <seconds>',
      'Poll interval in seconds',
      (v: string) => parsePositiveSeconds(v, '--poll-interval'),
      10,
    )
    .option('--output <format>', 'Output format: json, junit, markdown', 'json')
    .action(
      wrapAction(WRITE_OPEN_WORLD, async function (this: Command) {
        const options = this.opts() as {
          file?: string;
          stdin?: boolean;
          wait?: boolean;
          timeout?: number;
          pollInterval?: number;
          output?: string;
        };

        const output = options.output ?? 'json';
        if (!['json', 'junit', 'markdown'].includes(output)) {
          console.error(`Error: unsupported --output '${output}'. Use json, junit, or markdown.`);
          process.exit(GateExitCode.INVALID);
        }

        try {
          const content = await readExplicitFileOrStdin({
            file: options.file,
            stdin: options.stdin,
          });
          const gate = parseLightdashAiEvaluationGate(content);
          assertAllowedProject(this, gate.spec.projectUuid);
          const timeoutSeconds = options.timeout ?? 600;
          const pollIntervalSeconds = options.pollInterval ?? 10;
          const client = getClient();
          const { run, timedOut } = await resolveEvaluationRun(client, gate, {
            wait: options.wait === true,
            timeoutMs: timeoutSeconds * 1000,
            pollIntervalMs: pollIntervalSeconds * 1000,
          });

          if (timedOut) {
            const payload = {
              gateName: gate.metadata.name,
              exitCode: GateExitCode.TIMEOUT,
              passed: false,
              reasons: ['Timed out waiting for evaluation run to complete'],
              run,
            };
            if (output === 'json') console.log(JSON.stringify(payload, null, 2));
            else if (output === 'markdown') {
              console.log(formatGateTimeoutMarkdown(gate));
            } else {
              console.log(formatGateTimeoutJUnit(gate));
            }
            process.exit(GateExitCode.TIMEOUT);
          }

          const evaluation = evaluateGatePolicy(gate.spec.policy, run);

          const payload = {
            gateName: gate.metadata.name,
            projectUuid: gate.spec.projectUuid,
            agentUuid: gate.spec.agentUuid,
            evaluationUuid: gate.spec.evaluationUuid,
            runUuid: run.runUuid,
            ...evaluation,
          };

          if (output === 'json') {
            console.log(JSON.stringify(payload, null, 2));
          } else if (output === 'junit') {
            console.log(formatGateJUnit(gate, evaluation));
          } else {
            console.log(formatGateMarkdown(gate, evaluation));
          }

          process.exit(evaluation.exitCode);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Error evaluating gate:', message);
          process.exit(GateExitCode.ERROR);
        }
      }),
    );
}
