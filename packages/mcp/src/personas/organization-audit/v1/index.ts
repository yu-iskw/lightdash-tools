/**
 * Organization-audit persona: read-only org inventory, access, content health, schedulers.
 */

import { registerOrganizationAuditPrompts } from './prompts.js';
import { registerOrganizationAuditPlaybook } from './resources/playbooks.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const ORGANIZATION_AUDIT_PERSONA_PATH = '/organization-audit/v1/mcp' as const;

/** Explicit allowlist — must stay a deliberate subset of the shared registry. */
export const ORGANIZATION_AUDIT_TOOL_IDS = [
  'get_org_profile',
  'list_org_members',
  'get_org_member',
  'list_org_groups',
  'list_org_projects',
  'list_org_role_assignments',
  'list_custom_roles',
  'get_custom_role',
  'list_project_roles',
  'list_project_direct_access',
  'list_space_access',
  'resolve_effective_access',
  'list_content',
  'get_dashboard_meta',
  'list_validation_results',
  'get_project_user_activity',
  'list_project_schedulers',
  'get_scheduler',
] as const satisfies readonly ToolId[];

export const organizationAuditPersona: PersonaDefinition = {
  id: 'organization-audit',
  path: ORGANIZATION_AUDIT_PERSONA_PATH,
  serverName: 'lightdash-mcp-org-audit',
  toolIds: ORGANIZATION_AUDIT_TOOL_IDS,
  registerPrompts: (server) => {
    registerOrganizationAuditPrompts(server);
  },
  registerResources: (server) => {
    registerOrganizationAuditPlaybook(server);
  },
};
