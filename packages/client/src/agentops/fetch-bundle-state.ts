/**
 * Fetches current Lightdash state for AgentOps bundle operations.
 */

import { toAgentSnapshot, toEvaluationSnapshot } from '@lightdash-tools/common';

import type { LightdashClient } from '../client';
import type { BundleCurrentState, LightdashAiAgentBundle } from '@lightdash-tools/common';

export async function fetchBundleCurrentState(
  client: LightdashClient,
  bundle: LightdashAiAgentBundle,
): Promise<BundleCurrentState> {
  const projectUuid = bundle.spec.projectUuid;
  const summaries = await client.v1.aiAgents.listAgents(projectUuid);

  const agents = await Promise.all(
    summaries.map(async (summary) => {
      const evalSummaries = await client.v1.aiAgents.listEvaluations(projectUuid, summary.uuid);
      const evaluations = await Promise.all(
        evalSummaries.map((e) =>
          client.v1.aiAgents.getEvaluation(projectUuid, summary.uuid, e.evalUuid),
        ),
      );
      return {
        agent: toAgentSnapshot(summary),
        evaluations: evaluations.map(toEvaluationSnapshot),
      };
    }),
  );

  return { projectUuid, agents };
}
