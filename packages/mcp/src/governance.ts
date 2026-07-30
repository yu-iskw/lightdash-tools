import { getAllowedProjectUuids, getSafetyMode, isDryRunMode } from './config/runtime.js';
import { getPinnedProjectUuid } from './project-pin.js';

import type { LightdashMcpRequestContext } from './request-context.js';

export function buildMcpGovernance(): LightdashMcpRequestContext['governance'] {
  return {
    safetyMode: getSafetyMode(),
    dryRun: isDryRunMode(),
    allowedProjectUuids: getAllowedProjectUuids(),
    pinnedProjectUuid: getPinnedProjectUuid(),
  };
}
