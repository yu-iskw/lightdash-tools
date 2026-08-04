/**
 * Content-developer profile: project-scoped chart/dashboard authoring (ADR-0014).
 * Hybrid authoring behind a hard preview -> validate -> apply gate; no SQL, no delete,
 * no space create/update (spaces are Terraform / out-of-band).
 */

import {
  previewChartChangesTool,
  previewContentMoveTool,
  previewDashboardChangesTool,
} from '../../../tools/project/developer-content-preview.js';
import {
  addDashboardTileTool,
  compareChartVersionsTool,
  compareDashboardVersionsTool,
  confirmPreviewTool,
  createChartTool,
  createDashboardTool,
  duplicateChartTool,
  duplicateDashboardTool,
  moveContentTool,
  moveDashboardTileTool,
  removeDashboardTileTool,
  resizeDashboardTileTool,
  updateChartTool,
  updateDashboardTool,
  validateChartTool,
  validateDashboardTool,
} from '../../../tools/project/developer-content.js';
import { getChartAsCodeTool } from '../../../tools/project/developer-get-chart-as-code.js';
import { getProjectDeveloperTool } from '../../../tools/project/projects.js';
import {
  getChartTool,
  getDashboardTool,
  searchContentTool,
} from '../../../tools/project/reader-content.js';
import { getSpaceTool, listSpacesTool } from '../../../tools/project/spaces.js';

import { registerContentDeveloperPrompts } from './prompts.js';
import { registerContentDeveloperPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_DEVELOPER_PROFILE_PATH = '/content-developer/v1/mcp' as const;

export const contentDeveloperProfile: ProfileDefinition = {
  id: 'content-developer',
  path: CONTENT_DEVELOPER_PROFILE_PATH,
  serverName: 'lightdash-mcp-cdev',
  tools: [
    getProjectDeveloperTool,
    searchContentTool,
    listSpacesTool,
    getSpaceTool,
    getDashboardTool,
    getChartTool,
    previewChartChangesTool,
    previewDashboardChangesTool,
    previewContentMoveTool,
    getChartAsCodeTool,
    validateChartTool,
    validateDashboardTool,
    confirmPreviewTool,
    compareChartVersionsTool,
    compareDashboardVersionsTool,
    createChartTool,
    updateChartTool,
    duplicateChartTool,
    createDashboardTool,
    updateDashboardTool,
    duplicateDashboardTool,
    addDashboardTileTool,
    moveDashboardTileTool,
    removeDashboardTileTool,
    resizeDashboardTileTool,
    moveContentTool,
  ],
  registerPrompts: registerContentDeveloperPrompts,
  registerResources: registerContentDeveloperPlaybook,
};
