/**
 * AI agent-ops profile: thin Lightdash AI-agent API surface (ADR-0018).
 */

import { getProjectAgentTool, listProjectAgentsTool } from '../../../tools/ai-agents/agents.js';
import {
  evaluateAgentReadinessTool,
  getAgentModelsTool,
  getAgentSuggestionsTool,
  getExploreAccessSummaryTool,
} from '../../../tools/ai-agents/discovery.js';
import {
  appendAgentEvaluationPromptsTool,
  createAgentEvaluationTool,
  deleteAgentEvaluationTool,
  getAgentEvalRunResultsTool,
  getAgentEvaluationTool,
  listAgentEvaluationRunsTool,
  listAgentEvaluationsTool,
  runAgentEvaluationTool,
  updateAgentEvaluationTool,
} from '../../../tools/ai-agents/evaluations.js';
import { getAgentThreadTool, listAgentThreadsTool } from '../../../tools/ai-agents/threads.js';

import { registerAiAgentOpsPrompts } from './prompts.js';
import { registerAiAgentOpsPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const AI_AGENT_OPS_PROFILE_PATH = '/ai-agent-ops/v1/mcp' as const;

export const aiAgentOpsProfile: ProfileDefinition = {
  id: 'ai-agent-ops',
  path: AI_AGENT_OPS_PROFILE_PATH,
  serverName: 'lightdash-mcp-aops',
  tools: [
    listProjectAgentsTool,
    getProjectAgentTool,
    evaluateAgentReadinessTool,
    getAgentSuggestionsTool,
    getAgentModelsTool,
    getExploreAccessSummaryTool,
    listAgentThreadsTool,
    getAgentThreadTool,
    listAgentEvaluationsTool,
    getAgentEvaluationTool,
    createAgentEvaluationTool,
    updateAgentEvaluationTool,
    appendAgentEvaluationPromptsTool,
    deleteAgentEvaluationTool,
    runAgentEvaluationTool,
    listAgentEvaluationRunsTool,
    getAgentEvalRunResultsTool,
  ],
  registerPrompts: registerAiAgentOpsPrompts,
  registerResources: registerAiAgentOpsPlaybook,
};
