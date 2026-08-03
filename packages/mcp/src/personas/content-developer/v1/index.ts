/**
 * Content-developer persona: project-scoped chart/dashboard authoring (ADR-0014).
 * Hybrid authoring behind a hard preview -> validate -> apply gate; no SQL, no delete,
 * no space create/update (spaces are Terraform / out-of-band).
 */

import { registerContentDeveloperPrompts } from './prompts.js';
import { registerContentDeveloperPlaybook } from './resources/playbooks.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const CONTENT_DEVELOPER_PERSONA_PATH = '/content-developer/v1/mcp' as const;

/** Explicit allowlist — must stay a deliberate subset of the shared registry. */
export const CONTENT_DEVELOPER_TOOL_IDS = [
  'get_project',
  'search_content',
  'list_spaces',
  'get_space',
  'get_dashboard',
  'get_chart',
  'get_chart_as_code',
  'preview_chart_changes',
  'preview_dashboard_changes',
  'preview_content_move',
  'validate_chart',
  'validate_dashboard',
  'confirm_preview',
  'compare_chart_versions',
  'compare_dashboard_versions',
  'create_chart',
  'update_chart',
  'duplicate_chart',
  'create_dashboard',
  'update_dashboard',
  'duplicate_dashboard',
  'add_dashboard_tile',
  'move_dashboard_tile',
  'remove_dashboard_tile',
  'resize_dashboard_tile',
  'move_content',
] as const satisfies readonly ToolId[];

export const contentDeveloperPersona: PersonaDefinition = {
  id: 'content-developer',
  path: CONTENT_DEVELOPER_PERSONA_PATH,
  serverName: 'lightdash-mcp-cdev',
  toolIds: CONTENT_DEVELOPER_TOOL_IDS,
  registerPrompts: (server) => {
    registerContentDeveloperPrompts(server);
  },
  registerResources: (server) => {
    registerContentDeveloperPlaybook(server);
  },
};
