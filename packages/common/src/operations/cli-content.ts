/**
 * CLI content/validation operations (ADR-0013). Catalog metadata only — not MCP tools.
 */

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor } from './types';

const PROFILE_DISCOVERY: CapabilityProfile = 'discovery-readonly';
const PROFILE_CORE: CapabilityProfile = 'core-lifecycle';

const chartsList = defineOperation({
  id: 'cli.charts.list',
  summary: 'List charts in a project (Commander alias of charts-as-code list)',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/code/charts' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  cli: { commandPath: 'projects charts list' },
  profiles: [PROFILE_DISCOVERY],
});

const chartsCodeList = defineOperation({
  id: 'cli.charts.code.list',
  summary: 'Get charts in code representation',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/code/charts' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  cli: { commandPath: 'projects charts code list' },
  profiles: [PROFILE_DISCOVERY],
});

const chartsCodeUpsert = defineOperation({
  id: 'cli.charts.code.upsert',
  summary: 'Create or update chart by slug',
  http: { method: 'POST', path: '/api/v1/projects/{projectUuid}/code/charts/{slug}' },
  authorization: { safetyImpact: 'write-nondestructive' },
  sensitivity: 'none',
  cli: { commandPath: 'projects charts code upsert' },
  profiles: [PROFILE_CORE],
});

const dashboardsList = defineOperation({
  id: 'cli.dashboards.list',
  summary: 'List dashboards in a project',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/dashboards' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  cli: { commandPath: 'projects dashboards list' },
  profiles: [PROFILE_DISCOVERY],
});

const validateRun = defineOperation({
  id: 'cli.projects.validate.run',
  summary: 'Start project validation job',
  http: { method: 'POST', path: '/api/v1/projects/{projectUuid}/validate' },
  authorization: { safetyImpact: 'write-nondestructive' },
  sensitivity: 'none',
  cli: { commandPath: 'projects validate run' },
  profiles: [PROFILE_CORE],
});

const validateResults = defineOperation({
  id: 'cli.projects.validate.results',
  summary: 'List project validation results (v2, paginated)',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/validate' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  cli: { commandPath: 'projects validate results' },
  profiles: [PROFILE_DISCOVERY],
});

export const CLI_CONTENT_OPERATIONS: readonly OperationDescriptor[] = [
  chartsList,
  chartsCodeList,
  chartsCodeUpsert,
  dashboardsList,
  validateRun,
  validateResults,
];
