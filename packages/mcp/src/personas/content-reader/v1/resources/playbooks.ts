/**
 * Content-reader multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type ContentReaderPlaybookTopic = 'compare' | 'discover' | 'explain-run';

const playbooks = definePersonaPlaybooks<ContentReaderPlaybookTopic>({
  personaId: 'content-reader',
  moduleDir: __dirname,
  hardBans: `Do not mutate Lightdash resources.
Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
Do not download or bulk-export results.
Do not execute saved SQL charts (disabled by default on content-reader).
Do not override filter targets, operators, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts.
Do not execute content outside the resolved project (pass projectUuid or HTTP pin).
Do not present truncated results as complete.
Do not claim metric equivalence from matching labels alone.
Do not reveal secrets, warehouse credentials, hidden SQL, or inaccessible content.`,
  coreDescription: 'Hard bans, budgets, tools, project scope, and coverage semantics',
  topics: [
    {
      id: 'discover',
      title: 'Content-reader discover playbook',
      description: 'Intent classification and content discovery',
      file: 'discover.md',
    },
    {
      id: 'explain-run',
      title: 'Content-reader explain/run playbook',
      description: 'Inspect metadata and execute bounded saved content',
      file: 'explain-run.md',
    },
    {
      id: 'compare',
      title: 'Content-reader compare playbook',
      description: 'Compare and investigate differences between saved content',
      file: 'compare.md',
    },
  ],
});

export const CONTENT_READER_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_READER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_READER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerContentReaderPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
