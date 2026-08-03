/**
 * Catalog operation id → LightdashClient method path (ADR-0013 Phase 4).
 * Composed MCP workflows use `composed:<primaryMethod>` when no single client method exists.
 * Ledger-only MCP tools (no LightdashClient call) use `ledger:<token>`.
 */

export type ClientMethodRef = string;

const CLIENT_CHARTS_UPSERT_AS_CODE = 'v1.charts.upsertChartAsCode';
const CLIENT_CHARTS_GET_AS_CODE = 'v1.charts.getChartsAsCode';
const CLIENT_DASHBOARDS_V2_UPDATE = 'v2.dashboards.updateDashboard';
const CLIENT_CONTENT_SEARCH = 'v2.content.searchContent';
const LEDGER_PREVIEW = 'ledger:preview';

/**
 * Hard coverage map: every catalog operation id must appear here.
 * Values are `v1.*` / `v2.*` client method paths, `composed:…` for multi-call tools,
 * or `ledger:…` for MCP-local ledger tools with no client method.
 */
export const OPERATION_CLIENT_METHOD_MAP = {
  // ai-agents
  'ai-agents.admin.agents.list': 'v1.aiAgents.listAdminAgents',
  'ai-agents.admin.threads.list': 'v1.aiAgents.getAdminThreads',
  'ai-agents.admin.settings.get': 'v1.aiAgents.getAiOrganizationSettings',
  'ai-agents.admin.settings.update': 'v1.aiAgents.updateAiOrganizationSettings',
  'ai-agents.project.agents.list': 'v1.aiAgents.listAgents',
  'ai-agents.project.agents.get': 'v1.aiAgents.getAgent',
  'ai-agents.project.agents.create': 'v1.aiAgents.createAgent',
  'ai-agents.project.agents.update': 'v1.aiAgents.updateAgent',
  'ai-agents.project.agents.delete': 'v1.aiAgents.deleteAgent',
  'ai-agents.project.agents.evaluate-readiness': 'v1.aiAgents.evaluateAgentReadiness',
  'ai-agents.project.agents.suggestions': 'v1.aiAgents.getAgentSuggestions',
  'ai-agents.project.agents.models': 'v1.aiAgents.getAgentModelOptions',
  'ai-agents.project.explore-access-summary': 'v1.aiAgents.getExploreAccessSummary',
  'ai-agents.project.threads.list': 'v1.aiAgents.listAgentThreads',
  'ai-agents.project.threads.get': 'v1.aiAgents.getAgentThread',
  'ai-agents.project.threads.start': 'v1.aiAgents.startConversation',
  'ai-agents.project.threads.continue': 'v1.aiAgents.continueConversation',
  'ai-agents.project.evaluations.list': 'v1.aiAgents.listEvaluations',
  'ai-agents.project.evaluations.get': 'v1.aiAgents.getEvaluation',
  'ai-agents.project.evaluations.create': 'v1.aiAgents.createEvaluation',
  'ai-agents.project.evaluations.update': 'v1.aiAgents.updateEvaluation',
  'ai-agents.project.evaluations.append': 'v1.aiAgents.appendToEvaluation',
  'ai-agents.project.evaluations.delete': 'v1.aiAgents.deleteEvaluation',
  'ai-agents.project.evaluations.run': 'v1.aiAgents.runEvaluation',
  'ai-agents.project.evaluations.runs.list': 'v1.aiAgents.listEvaluationRuns',
  'ai-agents.project.evaluations.runs.get': 'v1.aiAgents.getEvaluationRunResults',

  // users
  'users.members.list': 'v1.users.listMembers',
  'users.members.get': 'v1.users.getMemberByUuid',
  'users.members.delete': 'v1.users.deleteMember',

  // semantic-layer
  'semantic.projects.list': 'v1.projects.listProjects',
  'semantic.projects.get': 'v1.projects.getProject',
  'semantic.explores.list': 'v1.explores.listExplores',
  'semantic.explores.get': 'v1.explores.getExplore',
  'semantic.explores.list_dimensions': 'v1.explores.listDimensions',
  'semantic.explores.get_field_lineage': 'v1.explores.getFieldLineage',
  'semantic.metrics.list': 'v1.metrics.listMetrics',
  'semantic.metrics.get': 'v1.metrics.getMetric',
  'semantic.query.compile': 'v1.query.compileQuery',

  // organization-audit
  'org-audit.org.profile.get': 'v1.organizations.getCurrentOrganization',
  'org-audit.members.list': 'v1.users.listMembers',
  'org-audit.members.get': 'v1.users.getMemberByUuid',
  'org-audit.groups.list': 'v1.groups.listGroups',
  'org-audit.projects.list': 'v1.projects.listProjects',
  'org-audit.roles.assignments.list': 'v2.organizationRoles.listRoleAssignments',
  'org-audit.roles.list': 'v2.organizationRoles.getRoles',
  'org-audit.roles.get': 'v2.organizationRoles.getRole',
  'org-audit.project.roles.list': 'v2.projectRoleAssignments.listAssignments',
  'org-audit.project.access.list': 'v1.projectAccess.listProjectAccess',
  'org-audit.space.access.list': 'composed:v1.spaces.listSpacesInProject+v1.spaces.getSpace',
  'org-audit.access.resolve':
    'composed:v2.organizationRoles.listRoleAssignments+v2.projectRoleAssignments.listAssignments',
  'org-audit.content.list': CLIENT_CONTENT_SEARCH,
  'org-audit.dashboards.meta.get': 'v2.dashboards.getDashboard',
  'org-audit.validation.list': 'v2.validation.listValidationResults',
  'org-audit.analytics.user-activity.get': 'v1.analytics.getUserActivity',
  'org-audit.schedulers.list': 'v1.schedulers.listSchedulers',
  'org-audit.schedulers.get': 'v1.schedulers.getScheduler',

  // content-reader
  'content-reader.content.search': CLIENT_CONTENT_SEARCH,
  'content-reader.spaces.list': 'v1.spaces.listSpacesInProject',
  'content-reader.spaces.get': 'v1.spaces.getSpace',
  'content-reader.dashboards.get': 'v2.dashboards.getDashboard',
  'content-reader.charts.get': 'v2.charts.getSavedChart',
  'content-reader.parameters.list': 'v2.parameters.listParameters',
  'content-reader.parameters.get': 'v2.parameters.getParameters',
  'content-reader.content.explain': 'composed:v2.charts.getSavedChart+v2.dashboards.getDashboard',
  'content-reader.charts.run': 'v2.query.runChartQuery',
  'content-reader.dashboards.run-tile': 'v2.query.runDashboardChartQuery',
  'content-reader.query.result.get': 'v2.query.getAsyncQueryResults',
  'content-reader.query.cancel': 'v2.query.cancelAsyncQuery',

  // content-developer
  'content-developer.preview.chart': 'composed:v2.charts.getSavedChart',
  'content-developer.preview.dashboard': 'composed:v2.dashboards.getDashboard',
  'content-developer.preview.content-move': LEDGER_PREVIEW,
  'content-developer.charts.get-as-code': CLIENT_CHARTS_GET_AS_CODE,
  'content-developer.charts.validate': 'v1.validation.validateChart',
  'content-developer.dashboards.validate': 'v1.validation.validateDashboard',
  'content-developer.preview.confirm': LEDGER_PREVIEW,
  'content-developer.charts.compare-versions':
    'composed:v2.charts.getSavedChart+v1.charts.getChartHistory+v1.charts.getChartVersion',
  'content-developer.dashboards.compare-versions':
    'composed:v2.dashboards.getDashboard+v1.dashboards.getDashboardHistory+v1.dashboards.getDashboardVersion',
  'content-developer.charts.create': CLIENT_CHARTS_UPSERT_AS_CODE,
  'content-developer.charts.update': CLIENT_CHARTS_UPSERT_AS_CODE,
  'content-developer.charts.duplicate': `composed:${CLIENT_CHARTS_GET_AS_CODE}+${CLIENT_CHARTS_UPSERT_AS_CODE}`,
  'content-developer.dashboards.create': 'v1.dashboards.createDashboard',
  'content-developer.dashboards.update': CLIENT_DASHBOARDS_V2_UPDATE,
  'content-developer.dashboards.duplicate': 'v1.dashboards.createDashboard',
  'content-developer.dashboards.tiles.add': CLIENT_DASHBOARDS_V2_UPDATE,
  'content-developer.dashboards.tiles.move': CLIENT_DASHBOARDS_V2_UPDATE,
  'content-developer.dashboards.tiles.remove': CLIENT_DASHBOARDS_V2_UPDATE,
  'content-developer.dashboards.tiles.resize': CLIENT_DASHBOARDS_V2_UPDATE,
  'content-developer.spaces.create': 'v1.spaces.createSpace',
  'content-developer.spaces.update': 'v1.spaces.updateSpace',
  'content-developer.content.move': 'v2.content.bulkMoveContent',

  // content-governance (ADR-0015 / ADR-0017)
  'content-governance.charts.delete': 'v2.charts.deleteSavedChart',
  'content-governance.dashboards.delete': 'v2.dashboards.deleteDashboard',
  'content-governance.dashboards.promote-diff': 'v1.dashboards.getDashboardPromoteDiff',
  'content-governance.dashboards.promote': 'v1.dashboards.promoteDashboard',
  'content-governance.content.permanent-delete': 'v2.content.permanentlyDeleteContent',

  // cli content
  'cli.charts.list': CLIENT_CHARTS_GET_AS_CODE,
  'cli.charts.code.list': CLIENT_CHARTS_GET_AS_CODE,
  'cli.charts.code.upsert': CLIENT_CHARTS_UPSERT_AS_CODE,
  'cli.dashboards.list': 'v1.dashboards.listDashboards',
  'cli.projects.validate.run': 'v1.validation.validateProject',
  'cli.projects.validate.results': 'v2.validation.listValidationResults',
} as const satisfies Record<string, ClientMethodRef>;

export type CataloguedOperationId = keyof typeof OPERATION_CLIENT_METHOD_MAP;

/** Returns the client method ref for a catalogued operation id. */
export function getClientMethodForOperation(operationId: CataloguedOperationId): ClientMethodRef;
export function getClientMethodForOperation(operationId: string): ClientMethodRef | undefined;
export function getClientMethodForOperation(operationId: string): ClientMethodRef | undefined {
  if (operationId in OPERATION_CLIENT_METHOD_MAP) {
    return OPERATION_CLIENT_METHOD_MAP[operationId as CataloguedOperationId];
  }
  return undefined;
}
