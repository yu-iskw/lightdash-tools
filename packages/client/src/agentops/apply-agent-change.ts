import { recordApplyFailure } from './apply-context';

import type { ApplyBundleContext } from './apply-context';
import type { BundleAgentSpec, BundleDiffChange, CreateAiAgent } from '@lightdash-tools/common';

function findDesiredAgent(ctx: ApplyBundleContext, key: string): BundleAgentSpec | undefined {
  return ctx.bundle.spec.agents.find((a) => a.key === key);
}

function buildCreateAgentBody(desired: BundleAgentSpec, projectUuid: string): CreateAiAgent {
  return {
    name: desired.name,
    projectUuid,
    description: desired.description ?? null,
    instruction: desired.instruction ?? null,
    tags: desired.tags ?? null,
    integrations: [],
    imageUrl: null,
    groupAccess: [],
    userAccess: [],
    spaceAccess: [],
    enableDataAccess: desired.enableDataAccess ?? false,
    enableSelfImprovement: desired.enableSelfImprovement ?? false,
    version: 1,
  };
}

export async function applyAgentChange(
  ctx: ApplyBundleContext,
  change: BundleDiffChange,
): Promise<boolean> {
  const { client, projectUuid, agentUuidByKey } = ctx;

  if (change.operation === 'create') {
    const desired = findDesiredAgent(ctx, change.key);
    if (!desired) {
      recordApplyFailure(ctx, change, `Agent spec not found for key '${change.key}'`);
      return false;
    }
    const created = await client.v1.aiAgents.createAgent(
      projectUuid,
      buildCreateAgentBody(desired, projectUuid),
    );
    agentUuidByKey.set(desired.key, created.uuid);
    return true;
  }

  if (change.operation === 'update') {
    const desired = findDesiredAgent(ctx, change.key);
    if (!desired) {
      recordApplyFailure(ctx, change, `Agent spec not found for key '${change.key}'`);
      return false;
    }
    const agentUuid = desired.uuid ?? change.agentUuid ?? agentUuidByKey.get(desired.key);
    if (!agentUuid) {
      recordApplyFailure(ctx, change, `Could not resolve agent UUID for key '${change.key}'`);
      return false;
    }
    await client.v1.aiAgents.updateAgent(projectUuid, agentUuid, {
      uuid: agentUuid,
      name: desired.name,
      description: desired.description ?? null,
      instruction: desired.instruction ?? null,
      tags: desired.tags ?? null,
      ...(desired.enableDataAccess !== undefined
        ? { enableDataAccess: desired.enableDataAccess }
        : {}),
      ...(desired.enableSelfImprovement !== undefined
        ? { enableSelfImprovement: desired.enableSelfImprovement }
        : {}),
    });
    agentUuidByKey.set(desired.key, agentUuid);
    return true;
  }

  if (change.operation === 'delete') {
    await client.v1.aiAgents.deleteAgent(projectUuid, change.key);
    return true;
  }

  return false;
}
