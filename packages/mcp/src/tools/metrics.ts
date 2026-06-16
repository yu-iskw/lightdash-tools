/**
 * MCP tools: metrics (list, get).
 */

import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import { wrapToolAnnotated, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerMetricsTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_metrics',
    {
      title: 'List metrics',
      description: 'List metrics in a project data catalog',
      inputSchema: {
        projectUuid: projectUuidField(),
        search: z.string().optional().describe('Search query'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_DEFAULT,
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
