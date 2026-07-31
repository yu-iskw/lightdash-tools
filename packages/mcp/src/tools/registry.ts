/**
 * Shared MCP tool registry: short id → register(server, ctx).
 * Wire names are always `lightdash_` + id via registerToolSafe.
 */

import {
  registerGetOrgMember,
  registerGetOrgProfile,
  registerListOrgGroups,
  registerListOrgMembers,
  registerListOrgProjects,
} from './organization/inventory.js';
import {
  registerGetCustomRole,
  registerListCustomRoles,
  registerListOrgRoleAssignments,
  registerListProjectDirectAccess,
  registerListProjectRoles,
} from './organization/roles.js';
import {
  registerGetDashboardMeta,
  registerGetProjectUserActivity,
  registerListContent,
  registerListValidationResults,
} from './project/content.js';
import { registerGetProject, registerListProjects } from './project/projects.js';
import { registerGetScheduler, registerListProjectSchedulers } from './project/schedulers.js';
import {
  registerGetExplore,
  registerGetFieldLineage,
  registerListDimensions,
  registerListExplores,
} from './semantic/explores.js';
import { registerGetMetric, registerListMetrics } from './semantic/metrics.js';
import { registerCompileQuery } from './semantic/query.js';
import { registerListSpaceAccess, registerResolveEffectiveAccess } from './space/access.js';

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

  // organization inventory / access / content / delivery (shared; persona allowlists select)
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
