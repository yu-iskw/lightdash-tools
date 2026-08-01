/**
 * Content-reader operations in the shared operation catalog (ADR-0013).
 */
import { READ_ONLY_DEFAULT, READ_ONLY_TRANSIENT } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor } from './types';

const PROFILE_CONTENT_READER: CapabilityProfile = 'content-reader';
const PROFILE_CONTENT_DEVELOPER: CapabilityProfile = 'content-developer';

const op_search_content = defineOperation({
  id: 'content-reader.content.search',
  summary: 'Search charts dashboards and spaces in a project',
  http: { method: 'GET', path: '/api/v2/content' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'search_content',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'content search' },
  profiles: [PROFILE_CONTENT_READER, PROFILE_CONTENT_DEVELOPER],
});

const op_list_spaces = defineOperation({
  id: 'content-reader.spaces.list',
  summary: 'List project spaces',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/spaces' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_spaces',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects spaces list' },
  profiles: [PROFILE_CONTENT_READER, PROFILE_CONTENT_DEVELOPER],
});

const op_get_space = defineOperation({
  id: 'content-reader.spaces.get',
  summary: 'Get a space with breadcrumbs and content summaries',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/spaces/{spaceUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_space',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects spaces get' },
  profiles: [PROFILE_CONTENT_READER, PROFILE_CONTENT_DEVELOPER],
});

const op_get_dashboard = defineOperation({
  id: 'content-reader.dashboards.get',
  summary: 'Get dashboard structure before tile execution',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_dashboard',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER, PROFILE_CONTENT_DEVELOPER],
});

const op_get_chart = defineOperation({
  id: 'content-reader.charts.get',
  summary: 'Get a saved chart definition',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_chart',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER, PROFILE_CONTENT_DEVELOPER],
});

const op_list_project_parameters = defineOperation({
  id: 'content-reader.parameters.list',
  summary: 'List project parameter definitions',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/parameters/list' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_project_parameters',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_get_project_parameters = defineOperation({
  id: 'content-reader.parameters.get',
  summary: 'Get project parameters by name',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/parameters' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_project_parameters',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_explain_content = defineOperation({
  id: 'content-reader.content.explain',
  summary: 'Explain saved content from metadata',
  http: { method: 'GET', path: '/api/v2/content' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'explain_content',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_run_chart = defineOperation({
  id: 'content-reader.charts.run',
  summary: 'Execute a saved semantic chart with bounded results',
  http: { method: 'POST', path: '/api/v2/projects/{projectUuid}/query/chart' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'run_chart',
    annotations: READ_ONLY_TRANSIENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_run_dashboard_tile = defineOperation({
  id: 'content-reader.dashboards.run-tile',
  summary: 'Execute a dashboard tile with bounded results',
  http: { method: 'POST', path: '/api/v2/projects/{projectUuid}/query/dashboard-chart' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'run_dashboard_tile',
    annotations: READ_ONLY_TRANSIENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_get_query_result = defineOperation({
  id: 'content-reader.query.result.get',
  summary: 'Get or poll a session-owned query result',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/query/{queryUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_query_result',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

const op_cancel_query = defineOperation({
  id: 'content-reader.query.cancel',
  summary: 'Cancel a running session-owned query',
  http: { method: 'POST', path: '/api/v2/projects/{projectUuid}/query/{queryUuid}/cancel' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'cancel_query',
    annotations: READ_ONLY_TRANSIENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_CONTENT_READER],
});

export const CONTENT_READER_OPERATIONS: readonly OperationDescriptor[] = [
  op_search_content,
  op_list_spaces,
  op_get_space,
  op_get_dashboard,
  op_get_chart,
  op_list_project_parameters,
  op_get_project_parameters,
  op_explain_content,
  op_run_chart,
  op_run_dashboard_tile,
  op_get_query_result,
  op_cancel_query,
];
