import { getPinnedProjectUuid } from './project-pin.js';

import type { LightdashMcpRequestContext } from './request-context.js';

export function buildMcpGovernance(): LightdashMcpRequestContext['governance'] {
  return {
    pinnedProjectUuid: getPinnedProjectUuid(),
  };
}
