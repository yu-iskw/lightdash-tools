/**
 * Content-governance persona: elicitation-gated soft-delete (ADR-0015).
 * Soft-delete charts/dashboards only; permanent purge and space delete stay off MCP.
 */

import { registerContentGovernancePrompts } from './prompts.js';
import { registerContentGovernancePlaybook } from './resources/playbooks.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const CONTENT_GOVERNANCE_PERSONA_PATH = '/content-governance/v1/mcp' as const;

/** Explicit allowlist — must stay a deliberate subset of the shared registry. */
export const CONTENT_GOVERNANCE_TOOL_IDS = [
  'delete_chart',
  'delete_dashboard',
] as const satisfies readonly ToolId[];

export const contentGovernancePersona: PersonaDefinition = {
  id: 'content-governance',
  path: CONTENT_GOVERNANCE_PERSONA_PATH,
  serverName: 'lightdash-mcp-gov',
  toolIds: CONTENT_GOVERNANCE_TOOL_IDS,
  registerPrompts: (server) => {
    registerContentGovernancePrompts(server);
  },
  registerResources: (server) => {
    registerContentGovernancePlaybook(server);
  },
};
