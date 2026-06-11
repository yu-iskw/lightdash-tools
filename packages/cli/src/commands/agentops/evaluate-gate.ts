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
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { readExplicitFileOrStdin } from '../../utils/file-input';
import { assertAllowedProject, wrapAction } from '../../utils/safety';

import type { Command } from 'commander';

export function registerAgentopsEvaluateGateCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('evaluate-gate')
    .description('Evaluate an evaluation gate policy against a run')
    .option('--file <path>', 'Path to gate YAML file')
    .option('--stdin', 'Read gate YAML from stdin')
    .option('--wait', 'Wait for the evaluation run to complete', false)
    .option('--timeout <seconds>', 'Wait timeout in seconds', (v: string) => parseInt(v, 10), 600)
    .option(
      '--poll-interval <seconds>',
      'Poll interval in seconds',
      (v: string) => parseInt(v, 10),
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
          const client = getClient();
          const { run, timedOut } = await resolveEvaluationRun(client, gate, {
            wait: options.wait === true,
            timeoutMs: (options.timeout ?? 600) * 1000,
            pollIntervalMs: (options.pollInterval ?? 10) * 1000,
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
              console.log(`# Evaluation Gate: ${gate.metadata.name}\n\n**Result:** TIMEOUT\n`);
            } else {
              console.log(
                `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${gate.metadata.name}" tests="1" failures="1">\n  <testcase name="timeout"><failure>Timed out</failure></testcase>\n</testsuite>\n`,
              );
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
          console.error(
            'Error evaluating gate:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(GateExitCode.ERROR);
        }
      }),
    );
}
