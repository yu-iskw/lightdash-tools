/**
 * Applies a computed bundle diff to Lightdash.
 */

import { applyAgentChange } from './apply-agent-change';
import { applyEvaluationChange } from './apply-evaluation-change';

import type { ApplyBundleContext, ApplyBundleDiffFailure } from './apply-context';
import type { LightdashClient } from '../client';
import type { BundleDiffChange, LightdashAiAgentBundle } from '@lightdash-tools/common';

export type { ApplyBundleDiffFailure } from './apply-context';

export interface ApplyBundleDiffResult {
  applied: number;
  skipped: number;
  failed: ApplyBundleDiffFailure[];
}

async function applyChange(ctx: ApplyBundleContext, change: BundleDiffChange): Promise<boolean> {
  if (change.resourceType === 'agent') {
    return applyAgentChange(ctx, change);
  }
  if (change.resourceType === 'evaluation') {
    return applyEvaluationChange(ctx, change);
  }
  return false;
}

export async function applyBundleDiff(
  client: LightdashClient,
  bundle: LightdashAiAgentBundle,
  changes: BundleDiffChange[],
): Promise<ApplyBundleDiffResult> {
  const ctx: ApplyBundleContext = {
    client,
    bundle,
    projectUuid: bundle.spec.projectUuid,
    agentUuidByKey: new Map<string, string>(),
    failed: [],
  };

  let applied = 0;
  let skipped = 0;

  for (const change of changes) {
    if (change.operation === 'noop') {
      skipped++;
      continue;
    }

    if (await applyChange(ctx, change)) {
      applied++;
    }
  }

  return { applied, skipped, failed: ctx.failed };
}
