/**
 * Organization-audit profile: read-only org inventory, access, content health, schedulers.
 */

import { registerOrganizationAuditPrompts } from './prompts.js';
import { registerOrganizationAuditPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const ORGANIZATION_AUDIT_PROFILE_PATH = '/organization-audit/v1/mcp' as const;

export const organizationAuditProfile: ProfileDefinition = {
  id: 'organization-audit',
  path: ORGANIZATION_AUDIT_PROFILE_PATH,
  serverName: 'lightdash-mcp-org-audit',
  registerPrompts: (server) => {
    registerOrganizationAuditPrompts(server);
  },
  registerResources: (server) => {
    registerOrganizationAuditPlaybook(server);
  },
};
