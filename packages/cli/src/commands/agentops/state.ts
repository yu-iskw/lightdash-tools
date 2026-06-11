/**
 * Fetches current Lightdash state for AgentOps bundle operations.
 */

import type {
  AgentStateSnapshot,
  BundleAgentSpec,
  BundleCurrentState,
  EvaluationStateSnapshot,
  LightdashAiAgentBundle,
} from '@lightdash-tools/common';
import type { LightdashClient } from '@lightdash-tools/client';

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
