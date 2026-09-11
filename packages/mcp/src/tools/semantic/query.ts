/**
 * MCP tools: query (compile only).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import { ensureFilterIds } from './ensure-filter-ids.js';
import {
  collectRequestedFieldIds,
  extractCompiledSql,
  findMissingFieldIds,
  isEmptySelectSql,
} from './explore-helpers.js';
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
        'Compile a metric query for an explore without executing it. Sets metricQuery.exploreName from exploreId (authoritative), defaults missing tableCalculations to [], and fills missing FilterGroup/FilterRule ids. Use fieldIds from list_dimensions (`{table}_{name}` with nested dots in name replaced by `__`). Empty SELECT or requested dimensions/metrics missing from SELECT aliases return isError. projectUuid optional when X-Lightdash-Project is set.',
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
            // Path exploreId is authoritative; OpenAPI MetricQuery requires exploreName + tableCalculations.
            const body = {
              ...metricQuery,
              filters: ensureFilterIds(metricQuery.filters ?? {}),
              tableCalculations: Array.isArray(metricQuery.tableCalculations)
                ? metricQuery.tableCalculations
                : [],
              exploreName: exploreId,
            };
            const result = await c.v1.query.compileQuery(
              scope.projectUuid,
              exploreId,
              body as never,
            );
            const sql = extractCompiledSql(result);
            const sqlError = (text: string) => ({
              content: [{ type: 'text' as const, text }],
              isError: true as const,
            });
            if (sql && isEmptySelectSql(sql)) {
              return sqlError(
                'Error: compile_query produced an empty SELECT (no columns). ' +
                  'Use fieldId values like `{table}_{name}` from list_dimensions (base table; nested dots → `__`), ' +
                  'not short field names. Re-compile after fixing metricQuery.',
              );
            }
            if (sql) {
              const missing = findMissingFieldIds(collectRequestedFieldIds(metricQuery), sql);
              if (missing.length > 0) {
                return sqlError(
                  'Error: compile_query SQL is missing SELECT aliases for requested fieldIds: ' +
                    `${missing.join(', ')}. ` +
                    'Copy fieldIds from list_dimensions (nested name dots become `__`) and explore-local metrics; re-compile.',
                );
              }
            }
            return jsonToolResult(result);
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

// ToolModule exports (profile mounts)
export const compileQueryTool = defineTool('compile_query', registerCompileQuery);
