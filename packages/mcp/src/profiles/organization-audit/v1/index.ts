/**
 * Organization-audit profile: read-only org inventory, access, content health, schedulers.
 */

import {
  getOrgMemberTool,
  getOrgProfileTool,
  listOrgGroupsTool,
  listOrgMembersTool,
  listOrgProjectsTool,
} from '../../../tools/organization/inventory.js';
import {
  getCustomRoleTool,
  listCustomRolesTool,
  listOrgRoleAssignmentsTool,
  listProjectDirectAccessTool,
  listProjectRolesTool,
} from '../../../tools/organization/roles.js';
import {
  getDashboardMetaTool,
  getProjectUserActivityTool,
  listContentTool,
  listValidationResultsTool,
} from '../../../tools/project/content.js';
import { getSchedulerTool, listProjectSchedulersTool } from '../../../tools/project/schedulers.js';
import { listSpaceAccessTool, resolveEffectiveAccessTool } from '../../../tools/space/access.js';

import { registerOrganizationAuditPrompts } from './prompts.js';
import { registerOrganizationAuditPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const ORGANIZATION_AUDIT_PROFILE_PATH = '/organization-audit/v1/mcp' as const;

export const organizationAuditProfile: ProfileDefinition = {
  id: 'organization-audit',
  path: ORGANIZATION_AUDIT_PROFILE_PATH,
  serverName: 'lightdash-mcp-org-audit',
  tools: [
    getOrgProfileTool,
    listOrgMembersTool,
    getOrgMemberTool,
    listOrgGroupsTool,
    listOrgProjectsTool,
    listOrgRoleAssignmentsTool,
    listCustomRolesTool,
    getCustomRoleTool,
    listProjectRolesTool,
    listProjectDirectAccessTool,
    listSpaceAccessTool,
    resolveEffectiveAccessTool,
    listContentTool,
    getDashboardMetaTool,
    listValidationResultsTool,
    getProjectUserActivityTool,
    listProjectSchedulersTool,
    getSchedulerTool,
  ],
  registerPrompts: registerOrganizationAuditPrompts,
  registerResources: registerOrganizationAuditPlaybook,
};
