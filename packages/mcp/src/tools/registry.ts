/**
 * Shared MCP tool registry: short id → register(server, ctx).
 * Wire names are always `lightdash_` + id via registerToolSafe.
 */

import {
  registerGetExplore,
  registerGetFieldLineage,
  registerListDimensions,
  registerListExplores,
} from './explores.js';
import { registerGetMetric, registerListMetrics } from './metrics.js';
import {
  registerAuditContentHealth,
  registerAuditIdentityAccess,
  registerAuditOrgSummary,
  registerAuditScheduledDeliveries,
  registerGetCustomRole,
  registerGetDashboardMeta,
  registerGetOrgMember,
  registerGetOrgProfile,
  registerGetProjectUserActivity,
  registerGetScheduler,
  registerListContent,
  registerListCustomRoles,
  registerListOrgGroups,
  registerListOrgMembers,
  registerListOrgProjects,
  registerListOrgRoleAssignments,
  registerListProjectDirectAccess,
  registerListProjectRoles,
  registerListProjectSchedulers,
  registerListSpaceAccess,
  registerListValidationResults,
  registerResolveEffectiveAccess,
} from './organization-audit/index.js';
import { registerGetProject, registerListProjects } from './projects.js';
import { registerCompileQuery } from './query.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type ToolRegistration = {
  register: (server: McpServer, contextProvider: McpContextProvider) => void;
};

export const toolRegistry = {
  // semantic-layer
  compile_query: { register: registerCompileQuery },
  get_explore: { register: registerGetExplore },
  get_field_lineage: { register: registerGetFieldLineage },
  get_metric: { register: registerGetMetric },
  get_project: { register: registerGetProject },
  list_dimensions: { register: registerListDimensions },
  list_explores: { register: registerListExplores },
  list_metrics: { register: registerListMetrics },
  list_projects: { register: registerListProjects },

  // organization-audit
  get_org_profile: { register: registerGetOrgProfile },
  list_org_members: { register: registerListOrgMembers },
  get_org_member: { register: registerGetOrgMember },
  list_org_groups: { register: registerListOrgGroups },
  list_org_projects: { register: registerListOrgProjects },
  list_org_role_assignments: { register: registerListOrgRoleAssignments },
  list_custom_roles: { register: registerListCustomRoles },
  get_custom_role: { register: registerGetCustomRole },
  list_project_roles: { register: registerListProjectRoles },
  list_project_direct_access: { register: registerListProjectDirectAccess },
  list_space_access: { register: registerListSpaceAccess },
  resolve_effective_access: { register: registerResolveEffectiveAccess },
  list_content: { register: registerListContent },
  get_dashboard_meta: { register: registerGetDashboardMeta },
  list_validation_results: { register: registerListValidationResults },
  get_project_user_activity: { register: registerGetProjectUserActivity },
  list_project_schedulers: { register: registerListProjectSchedulers },
  get_scheduler: { register: registerGetScheduler },
  audit_identity_access: { register: registerAuditIdentityAccess },
  audit_content_health: { register: registerAuditContentHealth },
  audit_scheduled_deliveries: { register: registerAuditScheduledDeliveries },
  audit_org_summary: { register: registerAuditOrgSummary },
} as const satisfies Record<string, ToolRegistration>;

export type ToolId = keyof typeof toolRegistry;

/** Register a subset of tools by id (persona allowlist). */
export function registerToolsByIds(
  server: McpServer,
  contextProvider: McpContextProvider,
  ids: readonly ToolId[],
): void {
  for (const id of ids) {
    // eslint-disable-next-line security/detect-object-injection -- ToolId union keys only
    const entry = toolRegistry[id];
    if (!entry) {
      throw new Error(`Unknown MCP tool id: ${String(id)}`);
    }
    entry.register(server, contextProvider);
  }
}
