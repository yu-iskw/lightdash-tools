/**
 * Semantic-layer profile: compile/discovery tools + playbook/prompts.
 */

import { getProjectTool, listProjectsTool } from '../../../tools/project/projects.js';
import {
  getExploreTool,
  getFieldLineageTool,
  listDimensionsTool,
  listExploresTool,
} from '../../../tools/semantic/explores.js';
import { getMetricTool, listMetricsTool } from '../../../tools/semantic/metrics.js';
import { compileQueryTool } from '../../../tools/semantic/query.js';

import { registerSemanticLayerPrompts } from './prompts.js';
import { registerSemanticLayerPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const SEMANTIC_LAYER_PROFILE_PATH = '/semantic-layer/v1/mcp' as const;

export const semanticLayerProfile: ProfileDefinition = {
  id: 'semantic-layer',
  path: SEMANTIC_LAYER_PROFILE_PATH,
  tools: [
    listProjectsTool,
    getProjectTool,
    listExploresTool,
    getExploreTool,
    listDimensionsTool,
    getFieldLineageTool,
    listMetricsTool,
    getMetricTool,
    compileQueryTool,
  ],
  registerPrompts: registerSemanticLayerPrompts,
  registerResources: registerSemanticLayerPlaybook,
};
