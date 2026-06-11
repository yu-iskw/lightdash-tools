/**
 * agentops evaluate-gate — evaluate an evaluation gate policy against a run.
 */

import {
  GateExitCode,
  WRITE_OPEN_WORLD,
  evaluateGatePolicy,
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { wrapAction } from '../../utils/safety';
import { readYamlInput } from '../agentops';

import type { GatePolicyEvaluation, GateRunSnapshot, LightdashAiEvaluationGate } from '@lightdash-tools/common';
import type { Command } from 'commander';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toRunSnapshot(run: {
  runUuid: string;
  status: GateRunSnapshot['status'];
  passedAssessments: number;
  failedAssessments: number;
  completedAt: string | null;
}): GateRunSnapshot {
  return {
    runUuid: run.runUuid,
    status: run.status,
    passedAssessments: run.passedAssessments,
    failedAssessments: run.failedAssessments,
    completedAt: run.completedAt,
  };
}

async function resolveRun(
  gate: LightdashAiEvaluationGate,
  options: { wait: boolean; timeoutMs: number; pollIntervalMs: number },
): Promise<{ run: GateRunSnapshot; timedOut: boolean }> {
  const client = getClient();
  const { projectUuid, agentUuid, evaluationUuid } = gate.spec;
  let runUuid = gate.spec.runUuid;

  if (!runUuid && gate.spec.triggerRun) {
    const triggered = await client.v1.aiAgents.runEvaluation(projectUuid, agentUuid, evaluationUuid);
    runUuid = triggered.runUuid;
  }

  if (!runUuid) {
    const runs = await client.v1.aiAgents.listAllEvaluationRuns(projectUuid, agentUuid, evaluationUuid);
    const latest = runs[0];
    if (!latest) {
      throw new Error('No evaluation runs found. Set spec.triggerRun: true or spec.runUuid.');
    }
    runUuid = latest.runUuid;
  }

  const deadline = Date.now() + options.timeoutMs;

  while (true) {
    const runs = await client.v1.aiAgents.listAllEvaluationRuns(projectUuid, agentUuid, evaluationUuid);
    const run = runs.find((r) => r.runUuid === runUuid);
    if (!run) {
      throw new Error(`Run ${runUuid} not found`);
    }

    const snapshot = toRunSnapshot(run);
    if (snapshot.status === 'completed' || snapshot.status === 'failed') {
      return { run: snapshot, timedOut: false };
    }

    if (!options.wait) {
      return { run: snapshot, timedOut: false };
    }

    if (Date.now() >= deadline) {
      return { run: snapshot, timedOut: true };
    }

    await sleep(options.pollIntervalMs);
  }
}

function formatJUnit(gate: LightdashAiEvaluationGate, evaluation: GatePolicyEvaluation): string {
  const name = gate.metadata.name;
  const failures = evaluation.passed
    ? ''
    : `    <failure message="${evaluation.reasons.join('; ')}">Gate policy failed</failure>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${name}" tests="1" failures="${evaluation.passed ? 0 : 1}">\n  <testcase name="${name}" classname="agentops.evaluate-gate">\n${failures}  </testcase>\n</testsuite>\n`;
}

function formatMarkdown(gate: LightdashAiEvaluationGate, evaluation: GatePolicyEvaluation): string {
  const lines = [
    `# Evaluation Gate: ${gate.metadata.name}`,
    '',
    `**Result:** ${evaluation.passed ? 'PASSED' : 'FAILED'} (exit ${evaluation.exitCode})`,
    '',
    '## Metrics',
    `- Run status: ${evaluation.metrics.runStatus}`,
    `- Passed assessments: ${evaluation.metrics.passedAssessments}`,
    `- Failed assessments: ${evaluation.metrics.failedAssessments}`,
    `- Pass rate: ${evaluation.metrics.passRate ?? 'n/a'}`,
    '',
  ];
  if (evaluation.reasons.length > 0) {
    lines.push('## Reasons', ...evaluation.reasons.map((r) => `- ${r}`), '');
  }
  return lines.join('\n');
}

export function registerAgentopsEvaluateGateCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('evaluate-gate')
    .description('Evaluate an evaluation gate policy against a run')
    .option('--file <path>', 'Path to gate YAML file')
    .option('--stdin', 'Read gate YAML from stdin')
    .option('--wait', 'Wait for the evaluation run to complete', false)
    .option('--timeout <seconds>', 'Wait timeout in seconds', (v: string) => parseInt(v, 10), 600)
    .option('--poll-interval <seconds>', 'Poll interval in seconds', (v: string) => parseInt(v, 10), 10)
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
          const content = await readYamlInput({ file: options.file, stdin: options.stdin });
          const gate = parseLightdashAiEvaluationGate(content);
          const { run, timedOut } = await resolveRun(gate, {
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

          let evaluation = evaluateGatePolicy(gate.spec.policy, run);
          if (!options.wait && evaluation.exitCode === GateExitCode.RUN_IN_PROGRESS) {
            evaluation = {
              ...evaluation,
              exitCode: GateExitCode.RUN_IN_PROGRESS,
            };
          }

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
            console.log(formatJUnit(gate, evaluation));
          } else {
            console.log(formatMarkdown(gate, evaluation));
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
