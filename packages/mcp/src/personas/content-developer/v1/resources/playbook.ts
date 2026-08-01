/**
 * Static content-developer playbook resource.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/server';

export const CONTENT_DEVELOPER_PLAYBOOK_URI = 'lightdash://playbooks/content-developer';
export const CONTENT_DEVELOPER_PLAYBOOK_MIME = 'text/markdown';
export const CONTENT_DEVELOPER_PLAYBOOK_NAME = 'content_developer_playbook';

export const CONTENT_DEVELOPER_HARD_BANS = `Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
Do not author or upsert SQL charts.
Do not hard-delete, rollback, or promote content.
Do not perform organization administration.
Do not apply a write tool without a validated, unexpired, session-owned previewId from the matching preview_* tool.
Do not reuse a previewId after it has been consumed by apply (single-use) or after the underlying resource has drifted (PREVIEW_STALE).
Do not reveal secrets, warehouse credentials, or hidden SQL.`;

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

export function registerContentDeveloperPlaybook(server: McpServer): void {
  const markdown = getPlaybookMarkdown();

  server.registerResource(
    CONTENT_DEVELOPER_PLAYBOOK_NAME,
    CONTENT_DEVELOPER_PLAYBOOK_URI,
    {
      title: 'Content-developer playbook',
      description:
        'How to preview, validate, and apply chart, dashboard, and space authoring changes safely',
      mimeType: CONTENT_DEVELOPER_PLAYBOOK_MIME,
    },
    async (uri) => ({
      contents: [
        {
          uri: typeof uri === 'string' ? uri : uri.href,
          mimeType: CONTENT_DEVELOPER_PLAYBOOK_MIME,
          text: markdown,
        },
      ],
    }),
  );
}
