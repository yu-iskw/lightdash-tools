/**
 * Content-reader persona: saved-content discovery + bounded execution.
 */

import { registerContentReaderPrompts } from './prompts.js';
import { registerContentReaderPlaybook } from './resources/playbook.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const CONTENT_READER_PERSONA_PATH = '/content-reader/v1/mcp' as const;

/** Explicit allowlist — must stay a deliberate subset of the shared registry. */
export const CONTENT_READER_TOOL_IDS = [
  'get_project',
  'search_content',
  'list_spaces',
  'get_space',
  'get_dashboard',
  'get_chart',
  'list_project_parameters',
  'get_project_parameters',
  'explain_content',
  'run_chart',
  'run_dashboard_tile',
  'get_query_result',
  'cancel_query',
] as const satisfies readonly ToolId[];

export const contentReaderPersona: PersonaDefinition = {
  id: 'content-reader',
  path: CONTENT_READER_PERSONA_PATH,
  serverName: 'lightdash-mcp-content',
  toolIds: CONTENT_READER_TOOL_IDS,
  registerPrompts: (server) => {
    registerContentReaderPrompts(server);
  },
  registerResources: (server) => {
    registerContentReaderPlaybook(server);
  },
};
