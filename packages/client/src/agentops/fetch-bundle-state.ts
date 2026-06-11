/**
 * Fetches current Lightdash state for AgentOps bundle operations.
 */

import { toAgentSnapshot, toEvaluationSnapshot } from '@lightdash-tools/common';

import type { LightdashClient } from '../client';
import type {
  BundleAgentSpec,
  BundleCurrentState,
  LightdashAiAgentBundle,
} from '@lightdash-tools/common';

export async function fetchBundleCurrentState(
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
