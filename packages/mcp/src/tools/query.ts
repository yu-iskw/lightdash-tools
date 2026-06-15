/**
 * MCP tools: query (compile).
 */

import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerQueryTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'compile_query',
    {
      title: 'Compile query',
      description: 'Compile a metric query for an explore without executing it',
      inputSchema: {
        projectUuid: projectUuidField(),
        exploreId: z.string().describe('Explore ID'),
        metricQuery: z
          .record(z.string(), z.unknown())
          .describe('Metric query object (dimensions, metrics, filters, etc.)'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          metricQuery,
        }: {
          projectUuid: string;
          exploreId: string;
          metricQuery: Record<string, unknown>;
        }) => {
          const result = await c.v1.query.compileQuery(
            projectUuid,
            exploreId,
            metricQuery as never,
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
