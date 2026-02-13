/**
 * MCP tools: metrics (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerMetricsTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_metrics',
    {
      title: 'List metrics',
      description: 'List metrics in a project data catalog',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        search: z.string().optional().describe('Search query'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          ...params
        }: {
          projectUuid: string;
          search?: string;
          page?: number;
          pageSize?: number;
        }) => {
          const result = await c.v1.metrics.listMetrics(projectUuid, params);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
