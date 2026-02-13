/**
 * MCP tools: content (search).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerContentTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'search_content',
    {
      title: 'Search content',
      description: 'Search for charts, dashboards, and spaces across projects',
      inputSchema: {
        search: z.string().describe('Search query'),
        projectUuids: z.array(z.string()).optional().describe('Optional project UUIDs to filter'),
        contentTypes: z
          .array(z.enum(['chart', 'dashboard', 'space']))
          .optional()
          .describe('Optional content types to filter'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async (params: {
          search: string;
          projectUuids?: string[];
          contentTypes?: ('chart' | 'dashboard' | 'space')[];
          page?: number;
          pageSize?: number;
        }) => {
          const result = await c.v2.content.searchContent(params);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
