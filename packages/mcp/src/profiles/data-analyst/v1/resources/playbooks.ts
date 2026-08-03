/**
 * Data-analyst multi-playbook resources (core + explore topic).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type DataAnalystPlaybookTopic = 'explore';

const playbooks = defineProfilePlaybooks<DataAnalystPlaybookTopic>({
  profileId: 'data-analyst',
  moduleDir: __dirname,
  hardBans: `Do not mutate Lightdash resources (create/update/delete/move charts or dashboards).
Do not run raw SQL, tableCalculations, underlying-data drills, or result downloads.
Do not execute saved charts (use content-reader) or invent fieldIds.
Do not present truncated results as complete.
Do not run queries outside the resolved project (pass projectUuid or HTTP pin).`,
  coreDescription: 'Hard bans, budgets, tools, and project scope',
  topics: [
    {
      id: 'explore',
      title: 'Data-analyst explore playbook',
      description: 'Compose and run unsaved metric queries (UI Explore loop)',
      file: 'explore.md',
    },
  ],
});

export const DATA_ANALYST_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const DATA_ANALYST_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const DATA_ANALYST_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerDataAnalystPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
