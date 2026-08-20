/**
 * AI-agent-chat profile: managed Lightdash AI-agent conversation (ADR-0029).
 */

import { listProjectAgentsTool } from '../../../tools/ai-agents/agents.js';
import {
  createAgentThreadMessageTool,
  createAgentThreadTool,
  generateAgentResponseTool,
} from '../../../tools/ai-agents/chat.js';
import { getUserAgentPreferencesTool } from '../../../tools/ai-agents/preferences.js';
import { getAgentThreadTool, listAgentThreadsTool } from '../../../tools/ai-agents/threads.js';

import { registerAiAgentChatPrompts } from './prompts.js';
import { registerAiAgentChatPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const AI_AGENT_CHAT_PROFILE_PATH = '/ai-agent-chat/v1/mcp' as const;

export const aiAgentChatProfile: ProfileDefinition = {
  id: 'ai-agent-chat',
  path: AI_AGENT_CHAT_PROFILE_PATH,
  serverName: 'lightdash-mcp-aichat',
  tools: [
    listProjectAgentsTool,
    getUserAgentPreferencesTool,
    listAgentThreadsTool,
    getAgentThreadTool,
    createAgentThreadTool,
    createAgentThreadMessageTool,
    generateAgentResponseTool,
  ],
  registerPrompts: registerAiAgentChatPrompts,
  registerResources: registerAiAgentChatPlaybook,
};
