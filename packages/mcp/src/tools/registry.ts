/**
 * Shared MCP tool registry: short id → register(server, ctx).
 * Wire names are always `lightdash_` + id via registerToolSafe.
 * Persona allowlists must resolve through the operation catalog (ADR-0013).
 */

import { getOperationByMcpToolName, listBannedMcpToolNames } from '@lightdash-tools/common';

import { registerExplainContent } from './composition/explain-content.js';
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
import {
  registerAddDashboardTile,
  registerCompareChartVersions,
  registerCompareDashboardVersions,
  registerConfirmPreview,
  registerCreateChart,
  registerCreateDashboard,
  registerCreateSpace,
  registerDuplicateChart,
  registerDuplicateDashboard,
  registerMoveContent,
  registerMoveDashboardTile,
  registerPreviewChartChanges,
  registerPreviewDashboardChanges,
  registerPreviewSpaceChanges,
  registerRemoveDashboardTile,
  registerResizeDashboardTile,
  registerUpdateChart,
  registerUpdateDashboard,
  registerUpdateSpace,
  registerValidateChart,
  registerValidateDashboard,
} from './project/developer-content.js';
import {
  registerGetProjectParameters,
  registerListProjectParameters,
} from './project/parameters.js';
import { registerGetProject, registerListProjects } from './project/projects.js';
import {
  registerGetChart,
  registerGetDashboard,
  registerSearchContent,
} from './project/reader-content.js';
import { registerRunChart, registerRunDashboardTile } from './project/reader-execution.js';
import { registerGetScheduler, registerListProjectSchedulers } from './project/schedulers.js';
import { registerGetSpace, registerListSpaces } from './project/spaces.js';
import { registerCancelQuery, registerGetQueryResult } from './query/lifecycle.js';
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
  register: (
    server: McpServer,
    contextProvider: McpContextProvider,
    options?: { personaId?: string },
  ) => void;
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

  // content-reader
  search_content: { register: registerSearchContent },
  list_spaces: { register: registerListSpaces },
  get_space: { register: registerGetSpace },
  get_dashboard: { register: registerGetDashboard },
  get_chart: { register: registerGetChart },
  list_project_parameters: { register: registerListProjectParameters },
  get_project_parameters: { register: registerGetProjectParameters },
  explain_content: { register: registerExplainContent },
  run_chart: { register: registerRunChart },
  run_dashboard_tile: { register: registerRunDashboardTile },
  get_query_result: { register: registerGetQueryResult },
  cancel_query: { register: registerCancelQuery },

  // content-developer (ADR-0014) — catalog/persona scaffold; handlers are stubs (see developer-content.ts)
  preview_chart_changes: { register: registerPreviewChartChanges },
  preview_dashboard_changes: { register: registerPreviewDashboardChanges },
  preview_space_changes: { register: registerPreviewSpaceChanges },
  validate_chart: { register: registerValidateChart },
  validate_dashboard: { register: registerValidateDashboard },
  confirm_preview: { register: registerConfirmPreview },
  compare_chart_versions: { register: registerCompareChartVersions },
  compare_dashboard_versions: { register: registerCompareDashboardVersions },
  create_chart: { register: registerCreateChart },
  update_chart: { register: registerUpdateChart },
  duplicate_chart: { register: registerDuplicateChart },
  create_dashboard: { register: registerCreateDashboard },
  update_dashboard: { register: registerUpdateDashboard },
  duplicate_dashboard: { register: registerDuplicateDashboard },
  add_dashboard_tile: { register: registerAddDashboardTile },
  move_dashboard_tile: { register: registerMoveDashboardTile },
  remove_dashboard_tile: { register: registerRemoveDashboardTile },
  resize_dashboard_tile: { register: registerResizeDashboardTile },
  create_space: { register: registerCreateSpace },
  update_space: { register: registerUpdateSpace },
  move_content: { register: registerMoveContent },
} as const satisfies Record<string, ToolRegistration>;

export type ToolId = keyof typeof toolRegistry;

const BANNED_MCP_TOOL_IDS = new Set(listBannedMcpToolNames());

/** Register a subset of tools by id (persona allowlist). Requires catalog parity (ADR-0013). */
export function registerToolsByIds(
  server: McpServer,
  contextProvider: McpContextProvider,
  ids: readonly ToolId[],
  options?: { personaId?: string },
): void {
  for (const id of ids) {
    if (BANNED_MCP_TOOL_IDS.has(id)) {
      throw new Error(`MCP tool id '${id}' is banned (client-only / irrecoverable)`);
    }
    const catalogOp = getOperationByMcpToolName(id);
    if (catalogOp?.mcp?.taskSupport.exposed !== true) {
      throw new Error(`MCP tool id '${id}' is not an exposed operation in the catalog (ADR-0013)`);
    }
    // eslint-disable-next-line security/detect-object-injection -- ToolId union keys only
    toolRegistry[id].register(server, contextProvider, options);
  }
}
