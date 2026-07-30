/**
 * Static semantic-layer playbook resource.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/server';

export const SEMANTIC_LAYER_PLAYBOOK_URI = 'lightdash://playbooks/semantic-layer';
export const SEMANTIC_LAYER_PLAYBOOK_MIME = 'text/markdown';
export const SEMANTIC_LAYER_PLAYBOOK_NAME = 'semantic_layer_playbook';

let cachedPlaybookMarkdown: string | undefined;

/** Loads playbook markdown from disk (next to this module after build). */
export function getPlaybookMarkdown(): string {
  if (cachedPlaybookMarkdown !== undefined) {
    return cachedPlaybookMarkdown;
  }
  // Playbook path is fixed next to this module (copied into dist on build).
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- __dirname + constant filename
  cachedPlaybookMarkdown = readFileSync(join(__dirname, 'playbook.md'), 'utf8');
  return cachedPlaybookMarkdown;
}

/** Clears the in-memory cache (tests). */
export function clearPlaybookMarkdownCache(): void {
  cachedPlaybookMarkdown = undefined;
}

export function registerPlaybookResource(server: McpServer): void {
  const markdown = getPlaybookMarkdown();

  server.registerResource(
    SEMANTIC_LAYER_PLAYBOOK_NAME,
    SEMANTIC_LAYER_PLAYBOOK_URI,
    {
      title: 'Semantic-layer playbook',
      description:
        'How to discover Lightdash explores/metrics and compile metric queries without running them',
      mimeType: SEMANTIC_LAYER_PLAYBOOK_MIME,
    },
    async (uri) => ({
      contents: [
        {
          uri: typeof uri === 'string' ? uri : uri.href,
          mimeType: SEMANTIC_LAYER_PLAYBOOK_MIME,
          text: markdown,
        },
      ],
    }),
  );
}
