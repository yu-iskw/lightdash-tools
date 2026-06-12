import type { LightdashClient } from '../client';
import type { BundleDiffChange, LightdashAiAgentBundle } from '@lightdash-tools/common';

export interface ApplyBundleDiffFailure {
  change: BundleDiffChange;
  reason: string;
}

export interface ApplyBundleContext {
  client: LightdashClient;
  bundle: LightdashAiAgentBundle;
  projectUuid: string;
  agentUuidByKey: Map<string, string>;
  failed: ApplyBundleDiffFailure[];
}

export function recordApplyFailure(
  ctx: ApplyBundleContext,
  change: BundleDiffChange,
  reason: string,
): void {
  ctx.failed.push({ change, reason });
}
