/**
 * AI agent-ops profile: thin Lightdash AI-agent API surface (ADR-0018).
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';

import { registerAiAgentOpsPrompts } from './prompts.js';
import { registerAiAgentOpsPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const AI_AGENT_OPS_PROFILE_PATH = '/ai-agent-ops/v1/mcp' as const;

export const aiAgentOpsProfile: ProfileDefinition = {
  id: 'ai-agent-ops',
  path: AI_AGENT_OPS_PROFILE_PATH,
  serverName: 'lightdash-mcp-aops',
  mcpToolNames: listMcpToolNamesByProfile('ai-agent-ops'),
  registerPrompts: (server) => {
    registerAiAgentOpsPrompts(server);
  },
  registerResources: (server) => {
    registerAiAgentOpsPlaybook(server);
  },
};
