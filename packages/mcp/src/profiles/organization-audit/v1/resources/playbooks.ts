/**
 * Organization-audit multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type OrganizationAuditPlaybookTopic = 'access' | 'content' | 'deliveries';

const playbooks = defineProfilePlaybooks<OrganizationAuditPlaybookTopic>({
  profileId: 'organization-audit',
  moduleDir: __dirname,
  hardBans:
    'Do not mutate users/groups/roles/content/schedulers, execute warehouse or chart queries, download user-activity CSV, reveal secrets, crawl unbounded org inventories, or claim compliance certification. Prefer core budgets (page/project caps). Those capabilities are not available on this server.',
  coreDescription: 'Hard bans, tool catalog, scope, and report rules',
  topics: [
    {
      id: 'access',
      title: 'Organization-audit access playbook',
      description: 'Identity and project/access governance phases',
      file: 'access.md',
    },
    {
      id: 'content',
      title: 'Organization-audit content playbook',
      description: 'Content inventory, validation, and usage health',
      file: 'content.md',
    },
    {
      id: 'deliveries',
      title: 'Organization-audit deliveries playbook',
      description: 'Scheduled delivery review without mutation',
      file: 'deliveries.md',
    },
  ],
});

export const ORGANIZATION_AUDIT_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const ORGANIZATION_AUDIT_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const ORGANIZATION_AUDIT_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerOrganizationAuditPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
