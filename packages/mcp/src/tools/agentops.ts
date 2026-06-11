/**
 * MCP tools: AgentOps bundle plan/apply and evaluation gate workflows (RFC Phase 2).
 */

import {
  GateExitCode,
  WRITE_NONDESTRUCTIVE,
  WRITE_OPEN_WORLD,
  computeBundleDiff,
  evaluateGatePolicy,
  isAllowed,
  parseLightdashAiAgentBundle,
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';
import { z } from 'zod';

import { getSafetyMode } from '../config.js';

import {
  jsonToolResult,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  wrapTool,
  WRITE_DESTRUCTIVE,
} from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type {
  AgentStateSnapshot,
  BundleAgentSpec,
  BundleCurrentState,
  BundleDiffChange,
  EvaluationStateSnapshot,
  GatePolicyEvaluation,
  GateRunSnapshot,
  LightdashAiAgentBundle,
  LightdashAiEvaluationGate,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ─── Shared state fetch (mirrors CLI packages/cli/src/commands/agentops/state.ts) ─

function toAgentSnapshot(agent: {
  uuid: string;
  name: string;
  description: string | null;
  instruction: string | null;
  tags: string[] | null;
  enableDataAccess?: boolean;
  enableSelfImprovement?: boolean;
  enableReasoning?: boolean;
}): AgentStateSnapshot {
  return {
    uuid: agent.uuid,
    name: agent.name,
    description: agent.description,
    instruction: agent.instruction,
    tags: agent.tags,
    enableDataAccess: agent.enableDataAccess,
    enableSelfImprovement: agent.enableSelfImprovement,
    enableReasoning: agent.enableReasoning,
  };
}

function toEvaluationSnapshot(evaluation: {
  evalUuid: string;
  title: string;
  description: string | null;
  prompts: Array<
    | { type?: 'string'; prompt: string; expectedResponse: string | null }
    | { type?: 'thread'; threadUuid: string; promptUuid: string; expectedResponse: string | null }
  >;
}): EvaluationStateSnapshot {
  return {
    evalUuid: evaluation.evalUuid,
    title: evaluation.title,
    description: evaluation.description,
    prompts: evaluation.prompts.map((p) => {
      if ('prompt' in p) {
        return {
          type: 'string' as const,
          prompt: p.prompt,
          expectedResponse: p.expectedResponse,
        };
      }
      return {
        type: 'thread' as const,
        threadUuid: p.threadUuid,
        promptUuid: p.promptUuid,
        expectedResponse: p.expectedResponse,
      };
    }),
  };
}

async function fetchBundleCurrentState(
  client: LightdashClient,
  bundle: LightdashAiAgentBundle,
): Promise<BundleCurrentState> {
  const projectUuid = bundle.spec.projectUuid;
  const summaries = await client.v1.aiAgents.listAgents(projectUuid);
  const relevantSummaries = summaries.filter((s) =>
    bundle.spec.agents.some((a: BundleAgentSpec) => a.uuid === s.uuid || a.name === s.name),
  );

  const agents = await Promise.all(
    relevantSummaries.map(async (summary) => {
      const agent = await client.v1.aiAgents.getAgent(projectUuid, summary.uuid);
      const evalSummaries = await client.v1.aiAgents.listEvaluations(projectUuid, summary.uuid);
      const evaluations = await Promise.all(
        evalSummaries.map((e) =>
          client.v1.aiAgents.getEvaluation(projectUuid, summary.uuid, e.evalUuid),
        ),
      );
      return {
        agent: toAgentSnapshot(agent),
        evaluations: evaluations.map(toEvaluationSnapshot),
      };
    }),
  );

  return { projectUuid, agents };
}

// ─── Apply (mirrors CLI packages/cli/src/commands/agentops/apply.ts) ───────────

function findDesiredAgent(
  bundle: LightdashAiAgentBundle,
  key: string,
): BundleAgentSpec | undefined {
  return bundle.spec.agents.find((a) => a.key === key);
}

function findDesiredEvaluation(
  agent: BundleAgentSpec,
  key: string,
): BundleAgentSpec['evaluations'][number] | undefined {
  return agent.evaluations.find((e) => e.key === key);
}

async function applyDiff(
  client: LightdashClient,
  bundle: LightdashAiAgentBundle,
  changes: BundleDiffChange[],
): Promise<{ applied: number; skipped: number }> {
  const projectUuid = bundle.spec.projectUuid;
  let applied = 0;
  let skipped = 0;
  const agentUuidByKey = new Map<string, string>();

  for (const change of changes) {
    if (change.operation === 'noop') {
      skipped++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'create') {
      const desired = findDesiredAgent(bundle, change.key);
      if (!desired) continue;
      const createBody = {
        name: desired.name,
        projectUuid,
        description: desired.description ?? null,
        instruction: desired.instruction ?? null,
        tags: desired.tags ?? null,
        ...(desired.enableDataAccess != null ? { enableDataAccess: desired.enableDataAccess } : {}),
        ...(desired.enableSelfImprovement != null
          ? { enableSelfImprovement: desired.enableSelfImprovement }
          : {}),
        ...(desired.enableReasoning != null ? { enableReasoning: desired.enableReasoning } : {}),
      } as Parameters<typeof client.v1.aiAgents.createAgent>[1];
      const created = await client.v1.aiAgents.createAgent(projectUuid, createBody);
      agentUuidByKey.set(desired.key, created.uuid);
      applied++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'update') {
      const desired = findDesiredAgent(bundle, change.key);
      if (!desired) continue;
      const agentUuid = desired.uuid ?? agentUuidByKey.get(desired.key);
      if (!agentUuid) continue;
      await client.v1.aiAgents.updateAgent(projectUuid, agentUuid, {
        uuid: agentUuid,
        name: desired.name,
        description: desired.description ?? null,
        instruction: desired.instruction ?? null,
        tags: desired.tags ?? null,
        enableDataAccess: desired.enableDataAccess,
        enableSelfImprovement: desired.enableSelfImprovement,
        enableReasoning: desired.enableReasoning,
      });
      agentUuidByKey.set(desired.key, agentUuid);
      applied++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'delete') {
      await client.v1.aiAgents.deleteAgent(projectUuid, change.key);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'create') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const desiredEval =
        desiredAgent && change.key ? findDesiredEvaluation(desiredAgent, change.key) : undefined;
      if (!desiredAgent || !desiredEval) continue;
      const agentUuid =
        change.agentUuid ?? desiredAgent.uuid ?? agentUuidByKey.get(desiredAgent.key);
      if (!agentUuid) continue;
      const createEvalBody = {
        title: desiredEval.title,
        ...(desiredEval.description != null ? { description: desiredEval.description } : {}),
        prompts: desiredEval.prompts.map((p) =>
          'prompt' in p
            ? { prompt: p.prompt, expectedResponse: p.expectedResponse ?? null }
            : {
                threadUuid: p.threadUuid,
                promptUuid: p.promptUuid,
                expectedResponse: p.expectedResponse ?? null,
              },
        ),
      } as Parameters<typeof client.v1.aiAgents.createEvaluation>[2];
      await client.v1.aiAgents.createEvaluation(projectUuid, agentUuid, createEvalBody);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'update') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const desiredEval =
        desiredAgent && change.key ? findDesiredEvaluation(desiredAgent, change.key) : undefined;
      if (!desiredAgent || !desiredEval) continue;
      const agentUuid =
        change.agentUuid ?? desiredAgent.uuid ?? agentUuidByKey.get(desiredAgent.key);
      const evalUuid = desiredEval.uuid;
      if (!agentUuid || !evalUuid) continue;
      const updateEvalBody = {
        title: desiredEval.title,
        ...(desiredEval.description != null ? { description: desiredEval.description } : {}),
        prompts: desiredEval.prompts.map((p) =>
          'prompt' in p
            ? { prompt: p.prompt, expectedResponse: p.expectedResponse ?? null }
            : {
                threadUuid: p.threadUuid,
                promptUuid: p.promptUuid,
                expectedResponse: p.expectedResponse ?? null,
              },
        ),
      } as Parameters<typeof client.v1.aiAgents.updateEvaluation>[3];
      await client.v1.aiAgents.updateEvaluation(projectUuid, agentUuid, evalUuid, updateEvalBody);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'delete') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const agentUuid =
        change.agentUuid ??
        desiredAgent?.uuid ??
        (change.agentKey ? agentUuidByKey.get(change.agentKey) : undefined);
      if (!agentUuid) continue;
      await client.v1.aiAgents.deleteEvaluation(projectUuid, agentUuid, change.key);
      applied++;
    }
  }

  return { applied, skipped };
}

// ─── Evaluate gate (mirrors CLI packages/cli/src/commands/agentops/evaluate-gate.ts)

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
  client: LightdashClient,
  gate: LightdashAiEvaluationGate,
  options: { wait: boolean; timeoutMs: number; pollIntervalMs: number },
): Promise<{ run: GateRunSnapshot; timedOut: boolean }> {
  const { projectUuid, agentUuid, evaluationUuid } = gate.spec;
  let runUuid = gate.spec.runUuid;

  if (!runUuid && gate.spec.triggerRun) {
    const triggered = await client.v1.aiAgents.runEvaluation(
      projectUuid,
      agentUuid,
      evaluationUuid,
    );
    runUuid = triggered.runUuid;
  }

  if (!runUuid) {
    const runs = await client.v1.aiAgents.listAllEvaluationRuns(
      projectUuid,
      agentUuid,
      evaluationUuid,
    );
    const latest = runs[0];
    if (!latest) {
      throw new Error('No evaluation runs found. Set spec.triggerRun: true or spec.runUuid.');
    }
    runUuid = latest.runUuid;
  }

  const deadline = Date.now() + options.timeoutMs;

  while (true) {
    const runs = await client.v1.aiAgents.listAllEvaluationRuns(
      projectUuid,
      agentUuid,
      evaluationUuid,
    );
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

const bundleYamlField = z.string().min(1).describe('Agent bundle document as YAML text');
const gateYamlField = z.string().min(1).describe('Evaluation gate document as YAML text');

export function registerAgentopsTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'ai_agentops_plan',
    {
      title: 'AgentOps plan bundle',
      description:
        'Validate an agent bundle YAML document, fetch current Lightdash state, and return the planned diff (read-only)',
      inputSchema: {
        bundleYaml: bundleYamlField,
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ bundleYaml }: { bundleYaml: string }) => {
      const bundle = parseLightdashAiAgentBundle(bundleYaml);
      const current = await fetchBundleCurrentState(c, bundle);
      const diff = computeBundleDiff(bundle, current);
      return jsonToolResult(diff);
    }),
  );

  registerToolSafe(
    server,
    'ai_agentops_apply',
    {
      title: 'AgentOps apply bundle',
      description: 'Apply an agent bundle YAML document to Lightdash',
      inputSchema: {
        bundleYaml: bundleYamlField,
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(client, (c) => async ({ bundleYaml }: { bundleYaml: string }) => {
      const bundle = parseLightdashAiAgentBundle(bundleYaml);
      const current = await fetchBundleCurrentState(c, bundle);
      const diff = computeBundleDiff(bundle, current);

      if (diff.summary.deletes > 0 && !isAllowed(getSafetyMode(), WRITE_DESTRUCTIVE)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: bundle requires destructive operations (deletes). Use safety mode write-destructive.',
            },
          ],
          isError: true,
        };
      }

      const result = await applyDiff(c, bundle, diff.changes);
      return jsonToolResult({
        bundleName: bundle.metadata.name,
        projectUuid: bundle.spec.projectUuid,
        summary: diff.summary,
        applied: result.applied,
        skipped: result.skipped,
      });
    }),
  );

  registerToolSafe(
    server,
    'ai_agentops_evaluate_gate',
    {
      title: 'AgentOps evaluate gate',
      description:
        'Evaluate an evaluation gate YAML policy against a run (may trigger a new run when spec.triggerRun is true)',
      inputSchema: {
        gateYaml: gateYamlField,
        wait: z
          .boolean()
          .optional()
          .describe('Wait for the evaluation run to complete (default false)'),
        timeoutSeconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Wait timeout in seconds (default 600)'),
        pollIntervalSeconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Poll interval in seconds when waiting (default 10)'),
        output: z
          .enum(['json', 'junit', 'markdown'])
          .optional()
          .describe('Output format (default json)'),
      },
      annotations: WRITE_OPEN_WORLD,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          gateYaml,
          wait,
          timeoutSeconds,
          pollIntervalSeconds,
          output,
        }: {
          gateYaml: string;
          wait?: boolean;
          timeoutSeconds?: number;
          pollIntervalSeconds?: number;
          output?: 'json' | 'junit' | 'markdown';
        }) => {
          const format = output ?? 'json';
          const gate = parseLightdashAiEvaluationGate(gateYaml);
          const { run, timedOut } = await resolveRun(c, gate, {
            wait: wait === true,
            timeoutMs: (timeoutSeconds ?? 600) * 1000,
            pollIntervalMs: (pollIntervalSeconds ?? 10) * 1000,
          });

          if (timedOut) {
            const payload = {
              gateName: gate.metadata.name,
              exitCode: GateExitCode.TIMEOUT,
              passed: false,
              reasons: ['Timed out waiting for evaluation run to complete'],
              run,
            };
            if (format === 'json') return jsonToolResult(payload);
            const text =
              format === 'markdown'
                ? `# Evaluation Gate: ${gate.metadata.name}\n\n**Result:** TIMEOUT\n`
                : `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${gate.metadata.name}" tests="1" failures="1">\n  <testcase name="timeout"><failure>Timed out</failure></testcase>\n</testsuite>\n`;
            return { content: [{ type: 'text' as const, text }] };
          }

          let evaluation = evaluateGatePolicy(gate.spec.policy, run);
          if (!wait && evaluation.exitCode === GateExitCode.RUN_IN_PROGRESS) {
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

          if (format === 'json') {
            return jsonToolResult(payload);
          }
          const text =
            format === 'junit' ? formatJUnit(gate, evaluation) : formatMarkdown(gate, evaluation);
          return { content: [{ type: 'text' as const, text }] };
        },
    ),
  );
}
