/**
 * Semantic-layer persona: compile/discovery tools + playbook/prompts.
 */

import { registerSemanticLayerPrompts } from './prompts.js';
import { registerPlaybookResource } from './resources/playbook.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const SEMANTIC_LAYER_PERSONA_PATH = '/semantic-layer/v1/mcp' as const;

/** Explicit allowlist — must stay a deliberate subset of the shared registry. */
export const SEMANTIC_LAYER_TOOL_IDS = [
  'list_projects',
  'get_project',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'get_field_lineage',
  'list_metrics',
  'get_metric',
  'compile_query',
] as const satisfies readonly ToolId[];

export const semanticLayerPersona: PersonaDefinition = {
  id: 'semantic-layer',
  path: SEMANTIC_LAYER_PERSONA_PATH,
  toolIds: SEMANTIC_LAYER_TOOL_IDS,
  registerPrompts: (server) => {
    registerSemanticLayerPrompts(server);
  },
  registerResources: (server) => {
    registerPlaybookResource(server);
  },
};
