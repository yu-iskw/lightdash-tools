import { getAllowedProjectUuids } from './config.js';
import { getPinnedProjectUuid } from './project-pin.js';

import type { LightdashMcpRequestContext } from './request-context.js';

export function buildMcpGovernance(): LightdashMcpRequestContext['governance'] {
  return {
    allowedProjectUuids: getAllowedProjectUuids(),
    pinnedProjectUuid: getPinnedProjectUuid(),
  };
}
