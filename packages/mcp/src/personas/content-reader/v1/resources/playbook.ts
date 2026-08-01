/**
 * Static content-reader playbook resource.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/server';

export const CONTENT_READER_PLAYBOOK_URI = 'lightdash://playbooks/content-reader';
export const CONTENT_READER_PLAYBOOK_MIME = 'text/markdown';
export const CONTENT_READER_PLAYBOOK_NAME = 'content_reader_playbook';

export const CONTENT_READER_HARD_BANS = `Do not mutate Lightdash resources.
Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.
Do not download or bulk-export results.
Do not execute saved SQL charts (disabled by default on content-reader).
Do not override filter targets, operators, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts.
Do not execute content outside the resolved project.
Do not present truncated results as complete.
Do not claim metric equivalence from matching labels alone.
Do not reveal secrets, warehouse credentials, hidden SQL, or inaccessible content.`;

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

export function registerContentReaderPlaybook(server: McpServer): void {
  const markdown = getPlaybookMarkdown();

  server.registerResource(
    CONTENT_READER_PLAYBOOK_NAME,
    CONTENT_READER_PLAYBOOK_URI,
    {
      title: 'Content-reader playbook',
      description:
        'How to discover, explain, and execute saved Lightdash charts and dashboards safely',
      mimeType: CONTENT_READER_PLAYBOOK_MIME,
    },
    async (uri) => ({
      contents: [
        {
          uri: typeof uri === 'string' ? uri : uri.href,
          mimeType: CONTENT_READER_PLAYBOOK_MIME,
          text: markdown,
        },
      ],
    }),
  );
}
