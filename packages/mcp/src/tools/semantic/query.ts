/**
 * MCP tools: query (compile only) — shared catalog.
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';

import { extractCompiledSql, isEmptySelectSql } from './explore-helpers.js';
import { exploreIdField } from './schema-fields.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerCompileQuery(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'compile_query',
    {
      title: 'Compile query',
      description:
        'Compile a metric query for an explore without executing it. Empty SELECT (no columns) is returned as an error — use fieldId `{table}_{name}`, not short names. projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        exploreId: exploreIdField(),
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
          projectUuid?: string;
          exploreId: string;
          metricQuery: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const result = await c.v1.query.compileQuery(
              scope.projectUuid,
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
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}
