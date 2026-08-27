import { buildSecureCreateAiAgentBody } from '@lightdash-tools/common';

import { recordApplyFailure } from './apply-context';

import type { ApplyBundleContext } from './apply-context';
import type { BundleAgentSpec, BundleDiffChange } from '@lightdash-tools/common';

function findDesiredAgent(ctx: ApplyBundleContext, key: string): BundleAgentSpec | undefined {
  return ctx.bundle.spec.agents.find((a) => a.key === key);
}

function buildAgentUpdatePatch(desired: BundleAgentSpec, agentUuid: string) {
  return {
    uuid: agentUuid,
    name: desired.name,
    description: desired.description ?? null,
    instruction: desired.instruction ?? null,
    tags: desired.tags ?? null,
    ...(desired.enableDataAccess !== undefined
      ? { enableDataAccess: desired.enableDataAccess }
      : {}),
    ...(desired.enableContentTools !== undefined
      ? { enableContentTools: desired.enableContentTools }
      : {}),
    ...(desired.enableSqlMode !== undefined ? { enableSqlMode: desired.enableSqlMode } : {}),
    ...(desired.enableUserContext !== undefined
      ? { enableUserContext: desired.enableUserContext }
      : {}),
    ...(desired.adminOnly !== undefined ? { adminOnly: desired.adminOnly } : {}),
    ...(desired.enableSelfImprovement !== undefined
      ? { enableSelfImprovement: desired.enableSelfImprovement }
      : {}),
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
      buildSecureCreateAiAgentBody({ ...desired, projectUuid }),
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
    const agentUuid = change.agentUuid ?? desired.uuid ?? agentUuidByKey.get(desired.key);
    if (!agentUuid) {
      recordApplyFailure(ctx, change, `Could not resolve agent UUID for key '${change.key}'`);
      return false;
    }
    await client.v1.aiAgents.updateAgent(
      projectUuid,
      agentUuid,
      buildAgentUpdatePatch(desired, agentUuid),
    );
    agentUuidByKey.set(desired.key, agentUuid);
    return true;
  }

  if (change.operation === 'delete') {
    await client.v1.aiAgents.deleteAgent(projectUuid, change.key);
    return true;
  }

  return false;
}
