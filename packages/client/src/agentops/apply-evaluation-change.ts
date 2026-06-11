import { recordApplyFailure } from './apply-context';

import type { ApplyBundleContext } from './apply-context';
import type {
  BundleAgentSpec,
  BundleDiffChange,
  BundleEvaluationSpec,
  CreateEvaluationBody,
  UpdateEvaluationBody,
} from '@lightdash-tools/common';

function findDesiredAgent(ctx: ApplyBundleContext, key: string): BundleAgentSpec | undefined {
  return ctx.bundle.spec.agents.find((a) => a.key === key);
}

function findDesiredEvaluation(
  agent: BundleAgentSpec,
  key: string,
): BundleEvaluationSpec | undefined {
  return agent.evaluations.find((e) => e.key === key);
}

function promptsToCreateBody(
  prompts: BundleEvaluationSpec['prompts'],
): CreateEvaluationBody['prompts'] {
  return prompts.map((p) =>
    'prompt' in p
      ? { prompt: p.prompt, expectedResponse: p.expectedResponse ?? null }
      : {
          threadUuid: p.threadUuid,
          promptUuid: p.promptUuid,
          expectedResponse: p.expectedResponse ?? null,
        },
  );
}

function buildUpdateEvaluationBody(desiredEval: BundleEvaluationSpec): UpdateEvaluationBody {
  // OpenAPI types omit null, but the API accepts null to clear an existing description.
  return {
    title: desiredEval.title,
    description: desiredEval.description ?? null,
    prompts: promptsToCreateBody(desiredEval.prompts),
  } as UpdateEvaluationBody;
}

function resolveAgentUuid(
  ctx: ApplyBundleContext,
  change: BundleDiffChange,
  desiredAgent?: BundleAgentSpec,
): string | undefined {
  return (
    change.agentUuid ??
    desiredAgent?.uuid ??
    (change.agentKey ? ctx.agentUuidByKey.get(change.agentKey) : undefined)
  );
}

export async function applyEvaluationChange(
  ctx: ApplyBundleContext,
  change: BundleDiffChange,
): Promise<boolean> {
  const { client, projectUuid } = ctx;
  const desiredAgent = change.agentKey ? findDesiredAgent(ctx, change.agentKey) : undefined;

  if (change.operation === 'create' || change.operation === 'update') {
    const desiredEval =
      desiredAgent && change.key ? findDesiredEvaluation(desiredAgent, change.key) : undefined;
    if (!desiredAgent) {
      recordApplyFailure(ctx, change, `Agent spec not found for key '${change.agentKey ?? ''}'`);
      return false;
    }
    if (!desiredEval) {
      recordApplyFailure(ctx, change, `Evaluation spec not found for key '${change.key}'`);
      return false;
    }
    const agentUuid = resolveAgentUuid(ctx, change, desiredAgent);
    if (!agentUuid) {
      recordApplyFailure(
        ctx,
        change,
        `Could not resolve agent UUID for evaluation key '${change.key}'`,
      );
      return false;
    }

    if (change.operation === 'create') {
      const createEvalBody: CreateEvaluationBody = {
        title: desiredEval.title,
        ...(desiredEval.description != null ? { description: desiredEval.description } : {}),
        prompts: promptsToCreateBody(desiredEval.prompts),
      };
      await client.v1.aiAgents.createEvaluation(projectUuid, agentUuid, createEvalBody);
      return true;
    }

    const evalUuid = desiredEval.uuid ?? change.evaluationUuid;
    if (!evalUuid) {
      recordApplyFailure(ctx, change, `Could not resolve evaluation UUID for key '${change.key}'`);
      return false;
    }
    await client.v1.aiAgents.updateEvaluation(
      projectUuid,
      agentUuid,
      evalUuid,
      buildUpdateEvaluationBody(desiredEval),
    );
    return true;
  }

  if (change.operation === 'delete') {
    const agentUuid = resolveAgentUuid(ctx, change, desiredAgent);
    if (!agentUuid) {
      recordApplyFailure(
        ctx,
        change,
        `Could not resolve agent UUID for evaluation delete '${change.key}'`,
      );
      return false;
    }
    await client.v1.aiAgents.deleteEvaluation(projectUuid, agentUuid, change.key);
    return true;
  }

  return false;
}
