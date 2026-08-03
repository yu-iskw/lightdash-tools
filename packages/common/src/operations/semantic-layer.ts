/**
 * Semantic-layer MCP/CLI operations in the shared operation catalog (ADR-0013).
 */

import { READ_ONLY_DEFAULT } from '../safety';

import { defineOperation } from './types';

import type { ProfileId, OperationDescriptor } from './types';

const PROFILE_SEMANTIC: ProfileId = 'semantic-layer';
const PROFILE_DATA_ANALYST: ProfileId = 'data-analyst';
const API_V1 = '/api/v1';

const listProjects = defineOperation({
  id: 'semantic.projects.list',
  summary: 'List organization projects (or pinned project when HTTP pin is set)',
  http: { method: 'GET', path: `${API_V1}/org/projects` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'secret.connection',
  mcp: {
    toolName: 'list_projects',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects list' },
  profiles: [PROFILE_SEMANTIC],
});

const getProject = defineOperation({
  id: 'semantic.projects.get',
  summary: 'Get a project by UUID (connection secrets omitted on MCP)',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'secret.connection',
  mcp: {
    toolName: 'get_project',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects get' },
  profiles: [PROFILE_SEMANTIC, 'content-reader', 'content-developer', PROFILE_DATA_ANALYST],
});

const listExplores = defineOperation({
  id: 'semantic.explores.list',
  summary: 'List explores in a project',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}/explores` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_explores',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects explores list' },
  profiles: [PROFILE_SEMANTIC, PROFILE_DATA_ANALYST],
});

const getExplore = defineOperation({
  id: 'semantic.explores.get',
  summary: 'Get a full explore definition',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}/explores/{exploreId}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_explore',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects explores get' },
  profiles: [PROFILE_SEMANTIC, PROFILE_DATA_ANALYST],
});

const listDimensions = defineOperation({
  id: 'semantic.explores.list_dimensions',
  summary: 'List dimensions for an explore (derived from get explore)',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}/explores/{exploreId}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_dimensions',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects explores dimensions' },
  profiles: [PROFILE_SEMANTIC, PROFILE_DATA_ANALYST],
});

const getFieldLineage = defineOperation({
  id: 'semantic.explores.get_field_lineage',
  summary: 'Get field lineage for an explore field (derived from get explore)',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}/explores/{exploreId}` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_field_lineage',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects explores lineage' },
  profiles: [PROFILE_SEMANTIC],
});

const listMetrics = defineOperation({
  id: 'semantic.metrics.list',
  summary: 'List metrics in the project data catalog',
  http: { method: 'GET', path: `${API_V1}/projects/{projectUuid}/dataCatalog/metrics` },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_metrics',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'metrics list' },
  profiles: [PROFILE_SEMANTIC, PROFILE_DATA_ANALYST],
});

const getMetric = defineOperation({
  id: 'semantic.metrics.get',
  summary: 'Get a metric from the project data catalog',
  http: {
    method: 'GET',
    path: `${API_V1}/projects/{projectUuid}/dataCatalog/metrics/{tableName}/{metricName}`,
  },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_metric',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'metrics get' },
  profiles: [PROFILE_SEMANTIC],
});

const compileQuery = defineOperation({
  id: 'semantic.query.compile',
  summary: 'Compile a metric query to SQL without executing warehouse rows',
  http: {
    method: 'POST',
    path: `${API_V1}/projects/{projectUuid}/explores/{exploreId}/compileQuery`,
  },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'compile_query',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'query compile' },
  profiles: [PROFILE_SEMANTIC, PROFILE_DATA_ANALYST],
});

/** Semantic-layer operations registered in the shared operation catalog. */
export const SEMANTIC_LAYER_OPERATIONS: readonly OperationDescriptor[] = [
  listProjects,
  getProject,
  listExplores,
  getExplore,
  listDimensions,
  getFieldLineage,
  listMetrics,
  getMetric,
  compileQuery,
];
