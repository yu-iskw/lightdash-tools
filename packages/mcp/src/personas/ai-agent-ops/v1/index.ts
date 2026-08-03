/**
 * AI agent-ops persona: thin Lightdash AI-agent API surface (ADR-0018).
 */

import { registerAiAgentOpsPrompts } from './prompts.js';
import { registerAiAgentOpsPlaybook } from './resources/playbooks.js';

import type { ToolId } from '../../../tools/registry.js';
import type { PersonaDefinition } from '../../types.js';

export const AI_AGENT_OPS_PERSONA_PATH = '/ai-agent-ops/v1/mcp' as const;

/** Explicit allowlist — Lightdash API primitives only; no offline eval mega-tools. */
export const AI_AGENT_OPS_TOOL_IDS = [
  'list_project_agents',
  'get_project_agent',
  'evaluate_agent_readiness',
  'get_agent_suggestions',
  'get_agent_models',
  'get_explore_access_summary',
  'list_agent_threads',
  'get_agent_thread',
  'list_agent_evaluations',
  'get_agent_evaluation',
  'create_agent_evaluation',
  'update_agent_evaluation',
  'append_agent_evaluation_prompts',
  'delete_agent_evaluation',
  'run_agent_evaluation',
  'list_agent_evaluation_runs',
  'get_agent_eval_run_results',
] as const satisfies readonly ToolId[];

export const aiAgentOpsPersona: PersonaDefinition = {
  id: 'ai-agent-ops',
  path: AI_AGENT_OPS_PERSONA_PATH,
  serverName: 'lightdash-mcp-aops',
  toolIds: AI_AGENT_OPS_TOOL_IDS,
  registerPrompts: (server) => {
    registerAiAgentOpsPrompts(server);
  },
  registerResources: (server) => {
    registerAiAgentOpsPlaybook(server);
  },
};
