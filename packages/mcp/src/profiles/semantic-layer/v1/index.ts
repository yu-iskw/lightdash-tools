/**
 * Semantic-layer profile: compile/discovery tools + playbook/prompts.
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';

import { registerSemanticLayerPrompts } from './prompts.js';
import { registerSemanticLayerPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const SEMANTIC_LAYER_PROFILE_PATH = '/semantic-layer/v1/mcp' as const;

export const semanticLayerProfile: ProfileDefinition = {
  id: 'semantic-layer',
  path: SEMANTIC_LAYER_PROFILE_PATH,
  mcpToolNames: listMcpToolNamesByProfile('semantic-layer'),
  registerPrompts: (server) => {
    registerSemanticLayerPrompts(server);
  },
  registerResources: (server) => {
    registerSemanticLayerPlaybook(server);
  },
};
