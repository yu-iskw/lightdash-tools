/**
 * AI agent-ops multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type AiAgentOpsPlaybookTopic = 'evaluation' | 'loop-engineering' | 'release-gate';

const playbooks = defineProfilePlaybooks<AiAgentOpsPlaybookTopic>({
  profileId: 'ai-agent-ops',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, tool catalog, truth labels, and distributed loop rules',
  topics: [
    {
      id: 'evaluation',
      title: 'AI agent-ops evaluation playbook',
      description: 'Product evaluation suites and readiness API usage',
      file: 'evaluation.md',
      useWhen: 'Designing, running, or comparing product evaluation suites',
      priority: 0.8,
    },
    {
      id: 'loop-engineering',
      title: 'AI agent-ops loop-engineering playbook',
      description: 'Host-driven improve loop across MCP, CLI, and other profiles',
      file: 'loop-engineering.md',
      useWhen: 'Investigating failures or running a bounded improve loop',
      priority: 0.75,
    },
    {
      id: 'release-gate',
      title: 'AI agent-ops release-gate playbook',
      description: 'Promotion decisions via CLI agentops evaluate-gate',
      file: 'release-gate.md',
      useWhen: 'Preparing a release recommendation or promotion gate',
      priority: 0.7,
    },
  ],
});

export { AI_AGENT_OPS_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const AI_AGENT_OPS_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const AI_AGENT_OPS_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const AI_AGENT_OPS_TOPIC_META = playbooks.TOPIC_META;

export function registerAiAgentOpsPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
