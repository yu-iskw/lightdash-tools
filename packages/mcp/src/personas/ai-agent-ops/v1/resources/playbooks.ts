/**
 * AI agent-ops multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type AiAgentOpsPlaybookTopic = 'evaluation' | 'loop-engineering' | 'release-gate';

const playbooks = definePersonaPlaybooks<AiAgentOpsPlaybookTopic>({
  personaId: 'ai-agent-ops',
  moduleDir: __dirname,
  hardBans:
    'Do not create/update/delete agents on this server, start or continue threads, mutate users/roles/semantic models/charts, run local offline scorers, write Git eval artifact stores via MCP, invent recommend_* or analyze_* mega-tools, or claim a CLI promotion gate passed from MCP run results alone. Those capabilities are not available as MCP mega-tools here — use CLI agentops / other personas / the host.',
  coreDescription: 'Hard bans, tool catalog, truth labels, and distributed loop rules',
  topics: [
    {
      id: 'evaluation',
      title: 'AI agent-ops evaluation playbook',
      description: 'Product evaluation suites and readiness API usage',
      file: 'evaluation.md',
    },
    {
      id: 'loop-engineering',
      title: 'AI agent-ops loop-engineering playbook',
      description: 'Host-driven improve loop across MCP, CLI, and other personas',
      file: 'loop-engineering.md',
    },
    {
      id: 'release-gate',
      title: 'AI agent-ops release-gate playbook',
      description: 'Promotion decisions via CLI agentops evaluate-gate',
      file: 'release-gate.md',
    },
  ],
});

export const AI_AGENT_OPS_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const AI_AGENT_OPS_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const AI_AGENT_OPS_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerAiAgentOpsPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
