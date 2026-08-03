/**
 * Saved-content execution tools for content-reader (semantic only; SQL disabled).
 */

import { z } from 'zod';

import { ProjectScopeError, resolveProjectScope } from '../../governance/project-scope.js';
import { SAVED_EXECUTION_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { ResultLimitError, clampRowLimit } from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { runBoundedSavedQuery } from '../query/bounded-saved-query.js';
import { classifyChartSource } from '../query/chart-source.js';
import { FilterOverrideError, applyFilterValueOverrides } from '../query/filter-overrides.js';
import { codedErrorResult, isCoverageComplete } from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { detectChartType } from './reader-content.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type {
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  components,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type DateZoom = components['schemas']['DateZoom'];

const dateZoomSchema = z
  .object({
    granularity: z.string().optional(),
    xAxisFieldId: z.string().optional(),
  })
  .optional();

export function registerRunChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'run_chart',
    {
      title: 'Run chart',
      description:
        'Execute one existing saved semantic chart (SQL charts disabled by default). Cache-first, bounded rows.',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuidOrSlug: uuidOrSlugField('Chart UUID or slug'),
        parameters: z.record(z.string(), z.unknown()).optional(),
        limit: z.number().int().positive().optional(),
        pivotResults: z.boolean().optional(),
        useCache: z.boolean().optional(),
        waitForResults: z.boolean().optional(),
        timeoutMs: z.number().int().nonnegative().optional(),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            chartUuidOrSlug: string;
            parameters?: Record<string, unknown>;
            limit?: number;
            pivotResults?: boolean;
            useCache?: boolean;
            waitForResults?: boolean;
            timeoutMs?: number;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              if (args.useCache === false) {
                return codedErrorResult(
                  'INVALID_PARAMETER_OVERRIDE',
                  'Cache bypass (useCache=false) is disabled in content-reader v1',
                );
              }
              const limit = clampRowLimit(args.limit);
              const preClass = await classifyChartSource(
                c,
                scope.projectUuid,
                args.chartUuidOrSlug,
              );
              if (preClass === 'sql') {
                return codedErrorResult(
                  'CONTENT_NOT_EXECUTABLE',
                  'Saved SQL chart execution is disabled by default on content-reader',
                );
              }
              const chart = asRecord(
                await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuidOrSlug),
              );
              const chartType = detectChartType(chart);
              if (chartType !== 'semantic') {
                return codedErrorResult(
                  'CONTENT_NOT_EXECUTABLE',
                  chartType === 'sql'
                    ? 'Saved SQL chart execution is disabled by default on content-reader'
                    : 'Chart type is not executable',
                );
              }
              const chartUuid = String(chart.uuid);

              const chartBody: ExecuteAsyncSavedChartRequestParams = {
                chartUuid,
                parameters: args.parameters as ExecuteAsyncSavedChartRequestParams['parameters'],
                limit,
                pivotResults: args.pivotResults,
                invalidateCache: false,
                context: 'chartView',
              };

              const bounded = await runBoundedSavedQuery({
                client: c,
                projectUuid: scope.projectUuid,
                sourceType: 'chart',
                sourceUuid: chartUuid,
                limit,
                waitForResults: args.waitForResults,
                timeoutMs: args.timeoutMs,
                execute: () => c.v2.query.runChartQuery(scope.projectUuid, chartBody),
              });
              if (!bounded.ok) {
                return bounded.result;
              }

              return jsonToolResult(
                contentReaderEnvelope(
                  {
                    ...bounded.normalized,
                    content: { type: 'chart' as const, uuid: chartUuid, name: chart.name },
                    appliedParameters: args.parameters ?? {},
                  },
                  {
                    profile,
                    projectUuid: scope.projectUuid,
                    projectPinned: scope.projectPinned,
                    complete: isCoverageComplete(bounded.normalized),
                    truncated: bounded.normalized.truncated,
                    warnings: bounded.warnings,
                  },
                ),
              );
            } catch (err) {
              if (err instanceof ProjectScopeError) {
                return codedErrorResult(err.code, err.message);
              }
              if (err instanceof ResultLimitError) {
                return codedErrorResult(err.code, err.message);
              }
              throw err;
            }
          },
      ),
  );
}

export function registerRunDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'run_dashboard_tile',
    {
      title: 'Run dashboard tile',
      description:
        'Execute one dashboard tile in dashboard context (saved semantic charts only; SQL tiles disabled)',
      safety: SAVED_EXECUTION_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        tileUuid: z.string(),
        filterOverrides: z
          .array(
            z.object({
              id: z.string(),
              values: z.array(z.unknown()),
            }),
          )
          .optional(),
        parameterOverrides: z.record(z.string(), z.unknown()).optional(),
        dateZoom: dateZoomSchema,
        limit: z.number().int().positive().optional(),
        useCache: z.boolean().optional(),
        waitForResults: z.boolean().optional(),
        timeoutMs: z.number().int().nonnegative().optional(),
      },
    },
    /* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- tile validation + execution */
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            dashboardUuidOrSlug: string;
            tileUuid: string;
            filterOverrides?: Array<{ id: string; values: unknown[] }>;
            parameterOverrides?: Record<string, unknown>;
            dateZoom?: DateZoom;
            limit?: number;
            useCache?: boolean;
            waitForResults?: boolean;
            timeoutMs?: number;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              if (args.useCache === false) {
                return codedErrorResult(
                  'INVALID_PARAMETER_OVERRIDE',
                  'Cache bypass (useCache=false) is disabled in content-reader v1',
                );
              }
              const limit = clampRowLimit(args.limit);
              const dashboard = asRecord(
                await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
              );
              const tiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
              const tile = tiles
                .map((t) => asRecord(t))
                .find((t) => String(t.uuid) === args.tileUuid);
              if (!tile) {
                return codedErrorResult(
                  'CONTENT_NOT_FOUND',
                  `Tile '${args.tileUuid}' not found on dashboard`,
                );
              }
              const tileType = String(tile.type ?? 'unknown');
              if (tileType === 'sql_chart') {
                return codedErrorResult(
                  'CONTENT_NOT_EXECUTABLE',
                  'Dashboard SQL chart tiles are disabled by default on content-reader',
                );
              }
              if (tileType !== 'saved_chart') {
                return codedErrorResult(
                  'CONTENT_NOT_EXECUTABLE',
                  `Tile type '${tileType}' is not executable`,
                );
              }
              const props = asRecord(tile.properties);
              const chartUuid = String(props.savedChartUuid ?? props.chartUuid ?? '');
              if (!chartUuid) {
                return codedErrorResult('CONTENT_NOT_EXECUTABLE', 'Tile has no saved chart UUID');
              }

              const { filters, warnings: filterWarnings } = applyFilterValueOverrides(
                dashboard.filters as
                  | {
                      dimensions?: Array<Record<string, unknown>>;
                      metrics?: Array<Record<string, unknown>>;
                      tableCalculations?: Array<Record<string, unknown>>;
                    }
                  | undefined,
                args.filterOverrides,
              );

              const body: ExecuteAsyncDashboardChartRequestParams = {
                dashboardUuid: String(dashboard.uuid),
                tileUuid: args.tileUuid,
                chartUuid,
                dashboardFilters:
                  filters as ExecuteAsyncDashboardChartRequestParams['dashboardFilters'],
                dashboardSorts: [],
                parameters:
                  args.parameterOverrides as ExecuteAsyncDashboardChartRequestParams['parameters'],
                dateZoom: args.dateZoom,
                limit,
                invalidateCache: false,
                context: 'dashboardView',
              };

              const bounded = await runBoundedSavedQuery({
                client: c,
                projectUuid: scope.projectUuid,
                sourceType: 'dashboard_tile',
                sourceUuid: args.tileUuid,
                limit,
                waitForResults: args.waitForResults,
                timeoutMs: args.timeoutMs,
                execute: () => c.v2.query.runDashboardChartQuery(scope.projectUuid, body),
              });
              if (!bounded.ok) {
                return bounded.result;
              }

              return jsonToolResult(
                contentReaderEnvelope(
                  {
                    ...bounded.normalized,
                    content: {
                      type: 'dashboard_tile' as const,
                      dashboardUuid: dashboard.uuid,
                      dashboardName: dashboard.name,
                      tileUuid: args.tileUuid,
                      chartUuid,
                      chartName: props.chartName,
                    },
                    appliedDashboardFilters: filters,
                    appliedDateZoom: args.dateZoom,
                  },
                  {
                    profile,
                    projectUuid: scope.projectUuid,
                    projectPinned: scope.projectPinned,
                    complete: isCoverageComplete(bounded.normalized),
                    truncated: bounded.normalized.truncated,
                    warnings: [
                      ...filterWarnings.map((message) => ({
                        code: 'FILTER_IGNORED' as const,
                        message,
                      })),
                      ...bounded.warnings,
                    ],
                  },
                ),
              );
            } catch (err) {
              if (err instanceof ProjectScopeError) {
                return codedErrorResult(err.code, err.message);
              }
              if (err instanceof ResultLimitError) {
                return codedErrorResult(err.code, err.message);
              }
              if (err instanceof FilterOverrideError) {
                return codedErrorResult(err.code, err.message);
              }
              throw err;
            }
          },
      ),
    /* eslint-enable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity */
  );
}
