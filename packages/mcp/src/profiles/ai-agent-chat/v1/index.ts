/**
 * AI-agent-chat profile: managed Lightdash AI-agent conversation (ADR-0029).
 */

import {
  getUserAgentPreferencesTool,
  listProjectAgentsTool,
} from '../../../tools/ai-agents/agents.js';
import { routeAgentTool } from '../../../tools/ai-agents/router.js';
import {
  createAgentThreadMessageTool,
  createAgentThreadTool,
  generateAgentResponseTool,
  getAgentThreadTool,
  listAgentThreadsTool,
} from '../../../tools/ai-agents/threads.js';
import { AI_AGENT_CHAT_PROFILE_PATH } from '../../catalog.js';

import { registerAiAgentChatPrompts } from './prompts.js';
import { registerAiAgentChatPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export { AI_AGENT_CHAT_PROFILE_PATH };

export const aiAgentChatProfile: ProfileDefinition = {
  id: 'ai-agent-chat',
  path: AI_AGENT_CHAT_PROFILE_PATH,
  serverName: 'lightdash-mcp-aichat',
  tools: [
    listProjectAgentsTool,
    getUserAgentPreferencesTool,
    routeAgentTool,
    listAgentThreadsTool,
    getAgentThreadTool,
    createAgentThreadTool,
    createAgentThreadMessageTool,
    generateAgentResponseTool,
  ],
  registerPrompts: registerAiAgentChatPrompts,
  registerResources: registerAiAgentChatPlaybook,
};
