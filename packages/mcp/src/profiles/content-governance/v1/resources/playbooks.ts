/**
 * Content-governance multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type ContentGovernancePlaybookTopic = 'charts' | 'dashboards';

const playbooks = defineProfilePlaybooks<ContentGovernancePlaybookTopic>({
  profileId: 'content-governance',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, elicitation SOP, tools, and project scope',
  topics: [
    {
      id: 'charts',
      title: 'Content-governance charts playbook',
      description: 'Soft-delete a saved chart with form elicitation',
      file: 'charts.md',
      useWhen: 'Soft-deleting a saved chart with form elicitation',
      priority: 0.8,
    },
    {
      id: 'dashboards',
      title: 'Content-governance dashboards playbook',
      description: 'Soft-delete or promote a dashboard with form elicitation',
      file: 'dashboards.md',
      useWhen: 'Soft-deleting or promoting a dashboard with form elicitation',
      priority: 0.75,
    },
  ],
});

export { CONTENT_GOVERNANCE_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_GOVERNANCE_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_GOVERNANCE_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const CONTENT_GOVERNANCE_TOPIC_META = playbooks.TOPIC_META;

export function registerContentGovernancePlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
