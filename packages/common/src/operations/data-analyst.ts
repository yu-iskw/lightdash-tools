/**
 * Data-analyst operations in the shared operation catalog (ADR-0020).
 */

import { READ_ONLY_TRANSIENT } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor } from './types';

const PROFILE_DATA_ANALYST: CapabilityProfile = 'data-analyst';

const op_run_metric_query = defineOperation({
  id: 'data-analyst.query.metric-query.run',
  summary: 'Execute an ad-hoc explore metric query with bounded async results',
  http: { method: 'POST', path: '/api/v2/projects/{projectUuid}/query/metric-query' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'run_metric_query',
    annotations: READ_ONLY_TRANSIENT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_DATA_ANALYST],
});

export const DATA_ANALYST_OPERATIONS: readonly OperationDescriptor[] = [op_run_metric_query];
