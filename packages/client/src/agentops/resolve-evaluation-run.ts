/**
 * Resolves and optionally polls an evaluation run for AgentOps gate workflows.
 */

import { toGateRunSnapshot } from '@lightdash-tools/common';

import type { LightdashClient } from '../client';
import type { GateRunSnapshot, LightdashAiEvaluationGate } from '@lightdash-tools/common';

export interface ResolveEvaluationRunOptions {
  wait: boolean;
  timeoutMs: number;
  pollIntervalMs: number;
}

export interface ResolveEvaluationRunResult {
  run: GateRunSnapshot;
  timedOut: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function resolveRunUuid(
  client: LightdashClient,
  gate: LightdashAiEvaluationGate,
): Promise<string> {
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
    const response = await client.v1.aiAgents.listEvaluationRuns(
      projectUuid,
      agentUuid,
      evaluationUuid,
      { page: 1, pageSize: 100 },
    );
    const latest = [...response.data.runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    if (!latest) {
      throw new Error('No evaluation runs found. Set spec.triggerRun: true or spec.runUuid.');
    }
    runUuid = latest.runUuid;
  }

  return runUuid;
}

export async function resolveEvaluationRun(
  client: LightdashClient,
  gate: LightdashAiEvaluationGate,
  options: ResolveEvaluationRunOptions,
): Promise<ResolveEvaluationRunResult> {
  const { projectUuid, agentUuid, evaluationUuid } = gate.spec;
  const runUuid = await resolveRunUuid(client, gate);
  const deadline = Date.now() + options.timeoutMs;

  while (true) {
    const run = await client.v1.aiAgents.getEvaluationRunResults(
      projectUuid,
      agentUuid,
      evaluationUuid,
      runUuid,
    );
    const snapshot = toGateRunSnapshot(run);

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
