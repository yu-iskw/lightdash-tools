/**
 * Content-developer operations in the shared operation catalog (ADR-0014).
 * Hybrid authoring surface: chart as-code upsert, dashboard REST create/update,
 * MCP-composed tile layout, and bulk content move into existing spaces.
 * Space create/update are client-only (spaces managed out-of-band, e.g. Terraform).
 * Preview -> validate -> apply is enforced by the persona policy layer, not here.
 */
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT, WRITE_NONDESTRUCTIVE } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor, SafetyImpact } from './types';

const PROFILE_CONTENT_DEVELOPER: CapabilityProfile = 'content-developer';
const API_V1 = '/api/v1';
const API_V2 = '/api/v2';
const WRITE_NONDESTRUCTIVE_IMPACT: SafetyImpact = 'write-nondestructive';
const PREVIEW_DIFF_SUMMARY =
  'Compute an in-memory diff and issue an HMAC-signed previewToken (no upstream preview API)';
const TILE_READ_SUMMARY = 'Read the current tile array (no per-tile REST route exists)';

const op_preview_chart_changes = defineOperation({
  id: 'content-developer.preview.chart',
  summary: 'Preview unsaved chart edits by diffing against the current saved definition',
  http: { method: 'GET', path: `${API_V2}/projects/{projectUuid}/saved/{chartUuidOrSlug}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'preview_chart_changes',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/saved/{chartUuidOrSlug}`,
      summary: 'Read the current saved chart definition',
    },
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/saved/{chartUuidOrSlug}`,
      summary: PREVIEW_DIFF_SUMMARY,
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_preview_dashboard_changes = defineOperation({
  id: 'content-developer.preview.dashboard',
  summary: 'Preview unsaved dashboard edits by diffing against the current saved definition',
  http: {
    method: 'GET',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'preview_dashboard_changes',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Read the current saved dashboard definition',
    },
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: PREVIEW_DIFF_SUMMARY,
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_preview_content_move = defineOperation({
  id: 'content-developer.preview.content-move',
  summary:
    'Preview a bulk content move into an existing space (issues an HMAC-signed previewToken)',
  http: { method: 'GET', path: `${API_V2}/content` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'preview_content_move',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/content`,
      summary: PREVIEW_DIFF_SUMMARY,
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_validate_chart = defineOperation({
  id: 'content-developer.charts.validate',
  summary: "Validate a saved chart's fields against its underlying explore",
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/validate/chart/{chartUuid}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'validate_chart',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_validate_dashboard = defineOperation({
  id: 'content-developer.dashboards.validate',
  summary: "Validate a saved dashboard's fields against its underlying explores",
  http: {
    method: 'POST',
    path: `${API_V1}/projects/{projectUuid}/validate/dashboard/{dashboardUuid}`,
  },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'validate_dashboard',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_compare_chart_versions = defineOperation({
  id: 'content-developer.charts.compare-versions',
  summary: 'Compare two chart version-history entries within the resolved project scope',
  http: { method: 'GET', path: `${API_V1}/saved/{chartUuid}/history` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'compare_chart_versions',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/saved/{chartUuid}`,
      summary: 'Verify the chart belongs to the resolved project scope',
    },
    { method: 'GET', path: `${API_V1}/saved/{chartUuid}/history`, summary: 'List chart versions' },
    {
      method: 'GET',
      path: `${API_V1}/saved/{chartUuid}/version/{versionUuid}`,
      summary: 'Fetch each compared version',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_compare_dashboard_versions = defineOperation({
  id: 'content-developer.dashboards.compare-versions',
  summary: 'Compare two dashboard version-history entries within the resolved project scope',
  http: { method: 'GET', path: `${API_V1}/dashboards/{dashboardUuidOrSlug}/history` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'compare_dashboard_versions',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Verify the dashboard belongs to the resolved project scope',
    },
    {
      method: 'GET',
      path: `${API_V1}/dashboards/{dashboardUuidOrSlug}/history`,
      summary: 'List dashboard versions',
    },
    {
      method: 'GET',
      path: `${API_V1}/dashboards/{dashboardUuidOrSlug}/version/{versionUuid}`,
      summary: 'Fetch each compared version',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_confirm_preview = defineOperation({
  id: 'content-developer.preview.confirm',
  summary:
    'Confirm a bound preview for create/duplicate/tile/content-move flows that have no upstream validate API',
  http: { method: 'GET', path: `${API_V2}/content` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'confirm_preview',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_create_chart = defineOperation({
  id: 'content-developer.charts.create',
  summary: 'Create a chart from code representation (as-code upsert by slug)',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/code/charts/{slug}` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'create_chart',
    annotations: WRITE_IDEMPOTENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_update_chart = defineOperation({
  id: 'content-developer.charts.update',
  summary: 'Update a chart from code representation (as-code upsert by slug)',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/code/charts/{slug}` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'update_chart',
    annotations: WRITE_IDEMPOTENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_duplicate_chart = defineOperation({
  id: 'content-developer.charts.duplicate',
  summary: 'Duplicate a chart by reading its as-code representation and upserting a new slug',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/code/charts/{slug}` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'duplicate_chart',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V1}/projects/{projectUuid}/code/charts`,
      summary: 'Read the source chart as-code representation',
    },
    {
      method: 'POST',
      path: `${API_V1}/projects/{projectUuid}/code/charts/{newSlug}`,
      summary: 'Upsert the duplicate under a new slug',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_create_dashboard = defineOperation({
  id: 'content-developer.dashboards.create',
  summary: 'Create a new dashboard in a project',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/dashboards` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'create_dashboard',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_update_dashboard = defineOperation({
  id: 'content-developer.dashboards.update',
  summary: 'Update a dashboard by UUID or slug',
  http: {
    method: 'PATCH',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'update_dashboard',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_duplicate_dashboard = defineOperation({
  id: 'content-developer.dashboards.duplicate',
  summary: 'Duplicate a dashboard via the duplicateFrom create parameter',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/dashboards` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'duplicate_dashboard',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'POST',
      path: `${API_V1}/projects/{projectUuid}/dashboards?duplicateFrom={dashboardUuid}`,
      summary: 'Create a dashboard duplicated from an existing one',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_add_dashboard_tile = defineOperation({
  id: 'content-developer.dashboards.tiles.add',
  summary: 'Add a tile to a dashboard by composing the full tile array and updating the dashboard',
  http: {
    method: 'PATCH',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'add_dashboard_tile',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: TILE_READ_SUMMARY,
    },
    {
      method: 'PATCH',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Write the full tile array back with the new tile appended',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_move_dashboard_tile = defineOperation({
  id: 'content-developer.dashboards.tiles.move',
  summary: 'Move a dashboard tile by composing the full tile array and updating the dashboard',
  http: {
    method: 'PATCH',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'move_dashboard_tile',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: TILE_READ_SUMMARY,
    },
    {
      method: 'PATCH',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Write the full tile array back with updated tile position',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_remove_dashboard_tile = defineOperation({
  id: 'content-developer.dashboards.tiles.remove',
  summary: 'Remove a dashboard tile by composing the full tile array and updating the dashboard',
  http: {
    method: 'PATCH',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'remove_dashboard_tile',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: TILE_READ_SUMMARY,
    },
    {
      method: 'PATCH',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Write the full tile array back with the tile removed',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_resize_dashboard_tile = defineOperation({
  id: 'content-developer.dashboards.tiles.resize',
  summary: 'Resize a dashboard tile by composing the full tile array and updating the dashboard',
  http: {
    method: 'PATCH',
    path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
  },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'resize_dashboard_tile',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  workflow: [
    {
      method: 'GET',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: TILE_READ_SUMMARY,
    },
    {
      method: 'PATCH',
      path: `${API_V2}/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}`,
      summary: 'Write the full tile array back with the updated tile size',
    },
  ],
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_create_space = defineOperation({
  id: 'content-developer.spaces.create',
  summary:
    'Create a space in a project (client-only; spaces are managed out-of-band, e.g. Terraform)',
  http: { method: 'POST', path: `${API_V1}/projects/{projectUuid}/spaces` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  agentExposure: 'client-only',
  bannedMcpToolName: 'create_space',
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_update_space = defineOperation({
  id: 'content-developer.spaces.update',
  summary:
    'Update a space in a project (client-only; spaces are managed out-of-band, e.g. Terraform)',
  http: { method: 'PATCH', path: `${API_V1}/projects/{projectUuid}/spaces/{spaceUuid}` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  agentExposure: 'client-only',
  bannedMcpToolName: 'update_space',
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

const op_move_content = defineOperation({
  id: 'content-developer.content.move',
  summary: 'Move one or more charts or dashboards to another space in one call',
  http: { method: 'POST', path: `${API_V2}/content/bulk-action/{projectUuid}/move` },
  authorization: { safetyImpact: WRITE_NONDESTRUCTIVE_IMPACT },
  sensitivity: 'none',
  mcp: {
    toolName: 'move_content',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_DEVELOPER],
});

export const CONTENT_DEVELOPER_OPERATIONS: readonly OperationDescriptor[] = [
  op_preview_chart_changes,
  op_preview_dashboard_changes,
  op_preview_content_move,
  op_validate_chart,
  op_validate_dashboard,
  op_confirm_preview,
  op_compare_chart_versions,
  op_compare_dashboard_versions,
  op_create_chart,
  op_update_chart,
  op_duplicate_chart,
  op_create_dashboard,
  op_update_dashboard,
  op_duplicate_dashboard,
  op_add_dashboard_tile,
  op_move_dashboard_tile,
  op_remove_dashboard_tile,
  op_resize_dashboard_tile,
  op_create_space,
  op_update_space,
  op_move_content,
];
