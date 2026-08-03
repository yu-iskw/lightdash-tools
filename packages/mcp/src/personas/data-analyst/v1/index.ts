/**
 * Data-analyst persona: explore discovery + ad-hoc metric-query execution (ADR-0020).
 */

import { registerDataAnalystPrompts } from './prompts.js';
import { registerDataAnalystPlaybook } from './resources/playbooks.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const DATA_ANALYST_PERSONA_PATH = '/data-analyst/v1/mcp' as const;

/** Explicit allowlist — explore compose + bounded metric-query; no saved-content mutation. */
export const DATA_ANALYST_TOOL_IDS = [
  'get_project',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'list_metrics',
  'compile_query',
  'run_metric_query',
  'get_query_result',
  'cancel_query',
] as const satisfies readonly ToolId[];

export const dataAnalystPersona: PersonaDefinition = {
  id: 'data-analyst',
  path: DATA_ANALYST_PERSONA_PATH,
  serverName: 'lightdash-mcp-analyst',
  toolIds: DATA_ANALYST_TOOL_IDS,
  registerPrompts: (server) => {
    registerDataAnalystPrompts(server);
  },
  registerResources: (server) => {
    registerDataAnalystPlaybook(server);
  },
};
