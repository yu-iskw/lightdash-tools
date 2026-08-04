/**
 * Content-reader profile: saved-content discovery + bounded execution.
 */

import { explainContentTool } from '../../../tools/composition/explain-content.js';
import {
  getProjectParametersTool,
  listProjectParametersTool,
} from '../../../tools/project/parameters.js';
import { getProjectReaderTool } from '../../../tools/project/projects.js';
import {
  getChartTool,
  getDashboardTool,
  searchContentTool,
} from '../../../tools/project/reader-content.js';
import { runChartTool, runDashboardTileTool } from '../../../tools/project/reader-execution.js';
import { exportChartImageTool } from '../../../tools/project/reader-export-chart-image.js';
import { getSpaceTool, listSpacesTool } from '../../../tools/project/spaces.js';
import { cancelQueryTool, getQueryResultTool } from '../../../tools/query/lifecycle.js';

import { registerContentReaderPrompts } from './prompts.js';
import { registerContentReaderPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_READER_PROFILE_PATH = '/content-reader/v1/mcp' as const;

export const contentReaderProfile: ProfileDefinition = {
  id: 'content-reader',
  path: CONTENT_READER_PROFILE_PATH,
  serverName: 'lightdash-mcp-content',
  tools: [
    getProjectReaderTool,
    searchContentTool,
    listSpacesTool,
    getSpaceTool,
    getDashboardTool,
    getChartTool,
    listProjectParametersTool,
    getProjectParametersTool,
    explainContentTool,
    runChartTool,
    exportChartImageTool,
    runDashboardTileTool,
    getQueryResultTool,
    cancelQueryTool,
  ],
  registerPrompts: registerContentReaderPrompts,
  registerResources: registerContentReaderPlaybook,
};
