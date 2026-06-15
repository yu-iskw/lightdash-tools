/**
 * MCP tools: schedulers (list, get).
 */

import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSchedulersTools(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_schedulers',
    {
      title: 'List schedulers',
      description: 'List scheduled deliveries in a project',
      inputSchema: {
        projectUuid: projectUuidField(),
        searchQuery: z.string().optional().describe('Search query'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          ...params
        }: {
          projectUuid: string;
          searchQuery?: string;
          page?: number;
          pageSize?: number;
        }) => {
          const result = await c.v1.schedulers.listSchedulers(projectUuid, params);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
