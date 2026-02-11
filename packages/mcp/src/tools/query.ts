/**
 * MCP tools: query (compile).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';

export function registerQueryTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'compile_query',
    {
      title: 'Compile query',
      description: 'Compile a metric query for an explore without executing it',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        exploreId: z.string().describe('Explore ID'),
        metricQuery: z
          .record(z.unknown())
          .describe('Metric query object (dimensions, metrics, filters, etc.)'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
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
