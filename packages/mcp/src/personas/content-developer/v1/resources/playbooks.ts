/**
 * Content-developer multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type ContentDeveloperPlaybookTopic = 'content-move' | 'dashboards';

const playbooks = definePersonaPlaybooks<ContentDeveloperPlaybookTopic>({
  personaId: 'content-developer',
  moduleDir: __dirname,
  hardBans: `Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
Do not author or upsert SQL charts.
Do not hard-delete, rollback, or promote content.
Do not perform organization administration.
Do not create or update spaces — spaces are managed outside this agent (e.g. Terraform).
Do not treat a standalone chart create/update as a finished publish unit; attach charts as dashboard tiles.
Do not apply a write tool without a confirmed, unexpired, session-owned previewId from the matching preview_* tool (confirm_preview unlocks every write).
Do not treat validate_chart / validate_dashboard as a preview unlock — they are saved-UUID health checks only.
Do not reuse a previewId after it has been consumed by apply (single-use) or after the underlying resource has drifted (PREVIEW_STALE).
Do not reveal secrets, warehouse credentials, or hidden SQL.`,
  coreDescription: 'Hard bans, tools, project scope, and preview gate',
  topics: [
    {
      id: 'dashboards',
      title: 'Content-developer dashboards playbook',
      description: 'Dashboard-first authoring with charts as tiles',
      file: 'dashboards.md',
    },
    {
      id: 'content-move',
      title: 'Content-developer content-move playbook',
      description: 'Move content into existing spaces (no space CRUD)',
      file: 'content-move.md',
    },
  ],
});

export const CONTENT_DEVELOPER_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_DEVELOPER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_DEVELOPER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerContentDeveloperPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
