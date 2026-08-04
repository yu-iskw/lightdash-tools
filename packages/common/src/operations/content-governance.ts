/**
 * Content-governance operations (ADR-0015 / ADR-0017).
 * Soft-delete charts/dashboards and dashboard promote via elicitation-required MCP tools.
 * Permanent purge stays client-only. Chart/SQL-chart promote stay off MCP in v1.
 */

import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE } from '../safety';

import { defineOperation } from './types';

import type { OperationDescriptor, SafetyImpact } from './types';

const IMPACT_READ: SafetyImpact = 'read';
const IMPACT_WRITE_DESTRUCTIVE: SafetyImpact = 'write-destructive';

const API_V1 = '/api/v1';
const API_V2 = '/api/v2';

const op_delete_chart = defineOperation({
  id: 'content-governance.charts.delete',
  summary:
    'Soft-delete a saved chart (MCP requires form elicitation; restorable until permanently purged)',
  http: {
    method: 'DELETE',
    path: `${API_V2}/projects/{projectUuid}/saved/{chartUuidOrSlug}`,
  },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'delete_chart',
    // Catalog keeps WRITE_DESTRUCTIVE defaults (idempotentHint: false). Soft-delete
    // retries are marked idempotent at MCP registration time (registerDestructiveDeleteTool).
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
});

const op_delete_dashboard = defineOperation({
  id: 'content-governance.dashboards.delete',
  summary:
    'Soft-delete a dashboard (MCP requires form elicitation; restorable until permanently purged)',
  http: {
    method: 'DELETE',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'delete_dashboard',
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
});

const op_get_dashboard_promote_diff = defineOperation({
  id: 'content-governance.dashboards.promote-diff',
  summary: 'Get promotion diff for a dashboard against its configured upstream project (read-only)',
  http: {
    method: 'GET',
    path: `${API_V1}/dashboards/{dashboardUuidOrSlug}/promoteDiff`,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_dashboard_promote_diff',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
});

const op_promote_dashboard = defineOperation({
  id: 'content-governance.dashboards.promote',
  summary: 'Promote a dashboard to its configured upstream project (MCP requires form elicitation)',
  http: {
    method: 'POST',
    path: `${API_V1}/dashboards/{dashboardUuidOrSlug}/promote`,
  },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'promote_dashboard',
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
});

const op_permanent_purge = defineOperation({
  id: 'content-governance.content.permanent-delete',
  summary:
    'Permanently delete soft-deleted content (client-only; irrecoverable — not exposed on MCP)',
  http: { method: 'DELETE', path: `${API_V2}/content/{projectUuid}/permanent` },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  agentExposure: 'client-only',
  bannedMcpToolName: 'permanent_delete_content',
});

export const CONTENT_GOVERNANCE_OPERATIONS: readonly OperationDescriptor[] = [
  op_delete_chart,
  op_delete_dashboard,
  op_get_dashboard_promote_diff,
  op_promote_dashboard,
  op_permanent_purge,
];
