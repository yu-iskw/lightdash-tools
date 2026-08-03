/**
 * Ad-hoc explore metric-query execution for data-analyst (ADR-0020).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METRIC_QUERY_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { ResultLimitError, clampRowLimit } from '../../policy/result-limits.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { runBoundedSavedQuery } from './bounded-saved-query.js';
import {
  codedErrorResult,
  isCoverageComplete,
  projectScopeErrorResult,
} from './reader-tool-helpers.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { ExecuteAsyncMetricQueryRequestParams } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

const sortFieldSchema = z.object({
  fieldId: z.string(),
  descending: z.boolean(),
  nullsFirst: z.boolean().optional(),
});

/** Dimension/metric filter groups only — tableCalculations SQL stay off MCP (ADR-0020). */
const filtersSchema = z
  .object({
    dimensions: z.unknown().optional(),
    metrics: z.unknown().optional(),
  })
  .default({});

const runMetricQueryInputSchema = z.object({
  projectUuid: optionalProjectUuidField(),
  exploreName: z
    .string()
    .describe('Explore name (same as exploreId from list_explores / get_explore)'),
  dimensions: z.array(z.string()).describe('Dimension fieldIds'),
  metrics: z.array(z.string()).describe('Metric fieldIds'),
  filters: filtersSchema.describe('Filter groups (dimensions / metrics only)'),
  sorts: z.array(sortFieldSchema).default([]),
  limit: z.number().int().positive().optional(),
  waitForResults: z.boolean().optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
});

type RunMetricQueryArgs = z.infer<typeof runMetricQueryInputSchema>;

export function registerRunMetricQuery(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'run_metric_query',
    {
      title: 'Run metric query',
      description:
        'Execute an unsaved explore metric query (dimensions, metrics, filters, sorts). Bounded rows; no chart save; no tableCalculations/SQL. Prefer fieldIds from get_explore / list_dimensions / list_metrics.',
      safety: METRIC_QUERY_SAFETY,
      inputSchema: runMetricQueryInputSchema.shape,
    },
    (profile) =>
      wrapTool(contextProvider, (c) => async (args: RunMetricQueryArgs) => {
        try {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const limit = clampRowLimit(args.limit);
          const body: ExecuteAsyncMetricQueryRequestParams = {
            query: {
              exploreName: args.exploreName,
              dimensions: args.dimensions,
              metrics: args.metrics,
              filters: args.filters ?? {},
              sorts: args.sorts ?? [],
              limit,
              tableCalculations: [],
            },
            invalidateCache: false,
            context: 'mcp.run_metric_query',
          };

          const bounded = await runBoundedSavedQuery({
            client: c,
            projectUuid: scope.projectUuid,
            sourceType: 'metric_query',
            sourceUuid: args.exploreName,
            limit,
            waitForResults: args.waitForResults,
            timeoutMs: args.timeoutMs,
            execute: () => c.v2.query.runMetricQuery(scope.projectUuid, body),
          });

          if (!bounded.ok) {
            return bounded.result;
          }

          return jsonToolResult(
            contentReaderEnvelope(bounded.normalized, {
              profile,
              projectUuid: scope.projectUuid,
              projectPinned: scope.projectPinned,
              complete: isCoverageComplete(bounded.normalized),
              truncated: bounded.normalized.truncated,
              warnings: bounded.warnings,
            }),
          );
        } catch (err) {
          if (err instanceof ResultLimitError) {
            return codedErrorResult(err.code, err.message);
          }
          return projectScopeErrorResult(err);
        }
      }),
  );
}
