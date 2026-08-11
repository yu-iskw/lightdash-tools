/**
 * Content-reader multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type ContentReaderPlaybookTopic = 'compare' | 'discover' | 'explain-run';

const playbooks = defineProfilePlaybooks<ContentReaderPlaybookTopic>({
  profileId: 'content-reader',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, budgets, tools, project scope, and coverage semantics',
  topics: [
    {
      id: 'discover',
      title: 'Content-reader discover playbook',
      description: 'Intent classification and content discovery',
      file: 'discover.md',
      useWhen:
        'Search results are weak, verified-only behavior matters, or discovery needs fallback',
      priority: 0.8,
    },
    {
      id: 'explain-run',
      title: 'Content-reader explain/run playbook',
      description: 'Inspect metadata and execute bounded saved content',
      file: 'explain-run.md',
      useWhen: 'Explaining or optionally executing a saved chart/dashboard',
      priority: 0.75,
    },
    {
      id: 'compare',
      title: 'Content-reader compare playbook',
      description: 'Compare and investigate differences between saved content',
      file: 'compare.md',
      useWhen: 'Comparing definitions or investigating result differences',
      priority: 0.7,
    },
  ],
});

export { CONTENT_READER_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_READER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_READER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const CONTENT_READER_TOPIC_META = playbooks.TOPIC_META;

export function registerContentReaderPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
