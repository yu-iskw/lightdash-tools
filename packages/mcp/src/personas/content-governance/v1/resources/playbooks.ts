/**
 * Content-governance multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type ContentGovernancePlaybookTopic = 'charts' | 'dashboards';

const playbooks = definePersonaPlaybooks<ContentGovernancePlaybookTopic>({
  personaId: 'content-governance',
  moduleDir: __dirname,
  hardBans: `Do not permanently purge soft-deleted content.
Do not delete spaces or perform bulk delete.
Do not soft-delete without form elicitation (never invent confirmed: true or chat-only approval).
Do not expose deletes on other personas or bypass the elicitation gate.
Do not restore, author, promote, or execute warehouse queries from this persona.
Do not reveal secrets, warehouse credentials, or hidden SQL.`,
  coreDescription: 'Hard bans, elicitation SOP, tools, and project scope',
  topics: [
    {
      id: 'charts',
      title: 'Content-governance charts playbook',
      description: 'Soft-delete a saved chart with form elicitation',
      file: 'charts.md',
    },
    {
      id: 'dashboards',
      title: 'Content-governance dashboards playbook',
      description: 'Soft-delete a dashboard with form elicitation',
      file: 'dashboards.md',
    },
  ],
});

export const CONTENT_GOVERNANCE_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_GOVERNANCE_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_GOVERNANCE_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerContentGovernancePlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
