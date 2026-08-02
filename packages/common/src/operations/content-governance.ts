/**
 * Content-governance operations (ADR-0015).
 * Soft-delete charts/dashboards via elicitation-required MCP tools.
 * Permanent purge stays client-only.
 */

import { WRITE_DESTRUCTIVE } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor, SafetyImpact } from './types';

const IMPACT_WRITE_DESTRUCTIVE: SafetyImpact = 'write-destructive';
const PROFILE_CONTENT_GOVERNANCE: CapabilityProfile = 'content-governance';

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
  profiles: [PROFILE_CONTENT_GOVERNANCE],
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
  profiles: [PROFILE_CONTENT_GOVERNANCE],
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
  profiles: [PROFILE_CONTENT_GOVERNANCE],
});

export const CONTENT_GOVERNANCE_OPERATIONS: readonly OperationDescriptor[] = [
  op_delete_chart,
  op_delete_dashboard,
  op_permanent_purge,
];
