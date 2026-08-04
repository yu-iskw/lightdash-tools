/**
 * Data-analyst profile: explore discovery + ad-hoc metric-query execution (ADR-0020).
 */

import { getProjectAnalystTool } from '../../../tools/project/projects.js';
import { cancelQueryTool, getQueryResultTool } from '../../../tools/query/lifecycle.js';
import { runMetricQueryTool } from '../../../tools/query/run-metric-query.js';
import {
  getExploreTool,
  listDimensionsTool,
  listExploresTool,
} from '../../../tools/semantic/explores.js';
import { listMetricsTool } from '../../../tools/semantic/metrics.js';
import { compileQueryTool } from '../../../tools/semantic/query.js';

import { registerDataAnalystPrompts } from './prompts.js';
import { registerDataAnalystPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const DATA_ANALYST_PROFILE_PATH = '/data-analyst/v1/mcp' as const;

export const dataAnalystProfile: ProfileDefinition = {
  id: 'data-analyst',
  path: DATA_ANALYST_PROFILE_PATH,
  serverName: 'lightdash-mcp-analyst',
  tools: [
    getProjectAnalystTool,
    listExploresTool,
    getExploreTool,
    listDimensionsTool,
    listMetricsTool,
    compileQueryTool,
    getQueryResultTool,
    cancelQueryTool,
    runMetricQueryTool,
  ],
  registerPrompts: registerDataAnalystPrompts,
  registerResources: registerDataAnalystPlaybook,
};
