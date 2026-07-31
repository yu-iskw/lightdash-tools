/**
 * Static organization-audit playbook resource.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/server';

export const ORGANIZATION_AUDIT_PLAYBOOK_URI = 'lightdash://playbooks/organization-audit';
export const ORGANIZATION_AUDIT_PLAYBOOK_MIME = 'text/markdown';
export const ORGANIZATION_AUDIT_PLAYBOOK_NAME = 'organization_audit_playbook';

export const ORGANIZATION_AUDIT_HARD_BANS =
  'Do not mutate users/groups/roles/content/schedulers, execute warehouse or chart queries, download user-activity CSV, reveal secrets, or claim compliance certification. Those capabilities are not available on this server.';

let cachedPlaybookMarkdown: string | undefined;

/** Loads playbook markdown from disk (next to this module after build). */
export function getPlaybookMarkdown(): string {
  if (cachedPlaybookMarkdown !== undefined) {
    return cachedPlaybookMarkdown;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- __dirname + constant filename
  cachedPlaybookMarkdown = readFileSync(join(__dirname, 'playbook.md'), 'utf8');
  return cachedPlaybookMarkdown;
}

export function registerOrganizationAuditPlaybook(server: McpServer): void {
  const markdown = getPlaybookMarkdown();

  server.registerResource(
    ORGANIZATION_AUDIT_PLAYBOOK_NAME,
    ORGANIZATION_AUDIT_PLAYBOOK_URI,
    {
      title: 'Organization-audit playbook',
      description:
        'How to inventory and audit Lightdash organization identity, access, content health, and deliveries',
      mimeType: ORGANIZATION_AUDIT_PLAYBOOK_MIME,
    },
    async (uri) => ({
      contents: [
        {
          uri: typeof uri === 'string' ? uri : uri.href,
          mimeType: ORGANIZATION_AUDIT_PLAYBOOK_MIME,
          text: markdown,
        },
      ],
    }),
  );
}
