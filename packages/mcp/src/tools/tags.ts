/**
 * MCP tools: tags (list).
 */

import { projectUuidField } from './schema-fields.js';
import { wrapToolAnnotated, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTagsTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_tags',
    {
      title: 'List tags',
      description: 'List all tags in a project',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_DEFAULT,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          const result = await c.v1.tags.listTags(projectUuid);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
