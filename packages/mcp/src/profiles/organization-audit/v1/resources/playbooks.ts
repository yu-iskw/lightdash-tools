/**
 * Organization-audit multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type OrganizationAuditPlaybookTopic = 'access' | 'content' | 'deliveries';

const playbooks = defineProfilePlaybooks<OrganizationAuditPlaybookTopic>({
  profileId: 'organization-audit',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, tool catalog, scope, and report rules',
  topics: [
    {
      id: 'access',
      title: 'Organization-audit access playbook',
      description: 'Identity and project/access governance phases',
      file: 'access.md',
      useWhen: 'Reviewing identity, roles, or effective access',
      priority: 0.8,
    },
    {
      id: 'content',
      title: 'Organization-audit content playbook',
      description: 'Content inventory, validation, and usage health',
      file: 'content.md',
      useWhen: 'Inventorying content health, validation, or usage',
      priority: 0.75,
    },
    {
      id: 'deliveries',
      title: 'Organization-audit deliveries playbook',
      description: 'Scheduled delivery review without mutation',
      file: 'deliveries.md',
      useWhen: 'Inspecting scheduled deliveries without mutation',
      priority: 0.7,
    },
  ],
});

export { ORGANIZATION_AUDIT_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const ORGANIZATION_AUDIT_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const ORGANIZATION_AUDIT_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const ORGANIZATION_AUDIT_TOPIC_META = playbooks.TOPIC_META;

export function registerOrganizationAuditPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
