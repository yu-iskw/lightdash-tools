/**
 * Data-analyst multi-playbook resources (core + explore topic).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import { DATA_ANALYST_HARD_BANS } from '../invariants.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type DataAnalystPlaybookTopic = 'explore';

const playbooks = defineProfilePlaybooks<DataAnalystPlaybookTopic>({
  profileId: 'data-analyst',
  moduleDir: __dirname,
  hardBans: DATA_ANALYST_HARD_BANS,
  coreDescription: 'Hard bans, budgets, tools, and project scope',
  topics: [
    {
      id: 'explore',
      title: 'Data-analyst explore playbook',
      description: 'Compose and run unsaved metric queries (UI Explore loop)',
      file: 'explore.md',
      useWhen: 'Composing and running unsaved metric queries',
      priority: 0.8,
    },
  ],
});

export { DATA_ANALYST_HARD_BANS };
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const DATA_ANALYST_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const DATA_ANALYST_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const DATA_ANALYST_TOPIC_META = playbooks.TOPIC_META;

export function registerDataAnalystPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
