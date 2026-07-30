/**
 * MCP tools: query (compile only).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

import { extractCompiledSql, isEmptySelectSql } from './explore-helpers.js';
import { exploreIdField, projectUuidField } from './schema-fields.js';
import { jsonToolResult, wrapTool } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerQueryTools(server: McpServer, contextProvider: McpContextProvider): void {
  server.registerTool(
    'compile_query',
    {
      title: 'Compile query',
      description:
        'Compile a metric query for an explore without executing it. Empty SELECT (no columns) is returned as an error — use fieldId `{table}_{name}`, not short names.',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
        metricQuery: z
          .record(z.string(), z.unknown())
          .describe('Metric query object (dimensions, metrics, filters, etc.)'),
      }),
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
          const sql = extractCompiledSql(result);
          if (sql && isEmptySelectSql(sql)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text:
                    'Error: compile_query produced an empty SELECT (no columns). ' +
                    'Use fieldId values like `{table}_{name}` from list_dimensions (base table), ' +
                    'not short field names. Re-compile after fixing metricQuery.',
                },
              ],
              isError: true,
            };
          }
          return jsonToolResult(result);
        },
    ),
  );
}
