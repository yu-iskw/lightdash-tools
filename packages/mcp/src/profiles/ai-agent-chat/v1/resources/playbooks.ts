/**
 * Multi-playbook resources for ai-agent-chat (core + conversation).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type AiAgentChatPlaybookTopic = 'conversation';

const playbooks = defineProfilePlaybooks<AiAgentChatPlaybookTopic>({
  profileId: 'ai-agent-chat',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, tool catalog, and open-world generation rules',
  topics: [
    {
      id: 'conversation',
      title: 'AI-agent-chat conversation playbook',
      description: 'Select an agent and run new, follow-up, or resume conversation flows',
      file: 'conversation.md',
      useWhen: 'Asking a Lightdash AI Agent a question or continuing a thread',
      priority: 0.8,
    },
  ],
});

export { AI_AGENT_CHAT_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const AI_AGENT_CHAT_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const AI_AGENT_CHAT_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const AI_AGENT_CHAT_TOPIC_META = playbooks.TOPIC_META;

export function registerAiAgentChatPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
