/**
 * MCP tools: tags (list).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerTagsTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_tags',
    {
      title: 'List tags',
      description: 'List all tags in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.tags.listTags(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
}
