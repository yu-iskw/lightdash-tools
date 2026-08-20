/**
 * Saved-content execution tools for content-reader (semantic charts + dashboard SQL tiles).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { SAVED_EXECUTION_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { ResultLimitError, clampRowLimit } from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { runBoundedSavedQuery } from '../query/bounded-saved-query.js';
import { classifyChartSource } from '../query/chart-source.js';
import {
  FilterOverrideError,
  applyFilterValueOverrides,
  type DashboardFiltersLike,
} from '../query/filter-overrides.js';
import {
  codedErrorResult,
  isCoverageComplete,
  projectScopeErrorResult,
} from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import { classifyDashboardTile, detectChartType } from './reader-content.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { TextContent } from '../shared.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type {
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ProfileId,
  components,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type DateZoom = components['schemas']['DateZoom'];
type ExecuteAsyncDashboardSqlChartRequestParams =
  components['schemas']['ExecuteAsyncDashboardSqlChartRequestParams'];

const dateZoomSchema = z
  .object({
    granularity: z.string().optional(),
    xAxisFieldId: z.string().optional(),
  })
  .optional();

const SQL_TILE_ROW_LEVEL_WARNING: ContentReaderWarning = {
  code: 'SQL_RESULT_MAY_BE_ROW_LEVEL',
  message: 'Dashboard SQL tile results may be grain-level rows, not semantic aggregates',
};

const DATE_ZOOM_IGNORED_ON_SQL_TILE: ContentReaderWarning = {
  code: 'DATE_ZOOM_IGNORED',
  message: 'dateZoom is not a field on dashboard-sql-chart; dashboard default granularity applies',
};

type DashboardTileSharedArgs = {
  client: LightdashClient;
  profile: ProfileId;
  projectUuid: string;
  projectPinned: boolean;
  dashboard: Record<string, unknown>;
  tileUuid: string;
  props: Record<string, unknown>;
  filters: DashboardFiltersLike;
  filterWarnings: string[];
  limit: number;
  parameterOverrides?: Record<string, unknown>;
  waitForResults?: boolean;
  timeoutMs?: number;
};

function filterOverrideWarnings(messages: string[]): ContentReaderWarning[] {
  return messages.map((message) => ({ code: 'FILTER_IGNORED' as const, message }));
}

type DashboardTileRequestBase = {
  context: 'dashboardView';
  dashboardFilters: ExecuteAsyncDashboardChartRequestParams['dashboardFilters'];
  dashboardSorts: ExecuteAsyncDashboardChartRequestParams['dashboardSorts'];
  dashboardUuid: string;
  invalidateCache: false;
  limit: number;
  parameters: ExecuteAsyncDashboardChartRequestParams['parameters'];
  tileUuid: string;
};

function dashboardTileRequestBase(args: DashboardTileSharedArgs): DashboardTileRequestBase {
  return {
    dashboardUuid: String(args.dashboard.uuid),
    tileUuid: args.tileUuid,
    dashboardFilters: args.filters as ExecuteAsyncDashboardChartRequestParams['dashboardFilters'],
    dashboardSorts: [],
    parameters: args.parameterOverrides as ExecuteAsyncDashboardChartRequestParams['parameters'],
    limit: args.limit,
    invalidateCache: false,
    context: 'dashboardView',
  };
}

async function executeSemanticDashboardTile(
  args: DashboardTileSharedArgs & { dateZoom?: DateZoom },
): Promise<TextContent> {
  const chartUuid = String(args.props.savedChartUuid ?? args.props.chartUuid ?? '');
  if (!chartUuid) {
    return codedErrorResult('CONTENT_NOT_EXECUTABLE', 'Tile has no saved chart UUID');
  }

  const body: ExecuteAsyncDashboardChartRequestParams = {
    ...dashboardTileRequestBase(args),
    chartUuid,
    dateZoom: args.dateZoom,
  };

  const bounded = await runBoundedSavedQuery({
    client: args.client,
    projectUuid: args.projectUuid,
    sourceType: 'dashboard_tile',
    sourceUuid: args.tileUuid,
    limit: args.limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runDashboardChartQuery(args.projectUuid, body),
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
          dashboardUuid: args.dashboard.uuid,
          dashboardName: args.dashboard.name,
          tileUuid: args.tileUuid,
          chartUuid,
          chartName: args.props.chartName,
        },
        appliedDashboardFilters: args.filters,
        appliedDateZoom: args.dateZoom,
      },
      {
        profile: args.profile,
        projectUuid: args.projectUuid,
        projectPinned: args.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: [...filterOverrideWarnings(args.filterWarnings), ...bounded.warnings],
      },
    ),
  );
}

async function executeSqlDashboardTile(
  args: DashboardTileSharedArgs & { savedSqlUuid: string; dateZoomIgnored: boolean },
): Promise<TextContent> {
  const body: ExecuteAsyncDashboardSqlChartRequestParams = {
    ...dashboardTileRequestBase(args),
    savedSqlUuid: args.savedSqlUuid,
    dashboardFilters:
      args.filters as ExecuteAsyncDashboardSqlChartRequestParams['dashboardFilters'],
  };

  const bounded = await runBoundedSavedQuery({
    client: args.client,
    projectUuid: args.projectUuid,
    sourceType: 'dashboard_tile',
    sourceUuid: args.tileUuid,
    limit: args.limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runDashboardSqlChartQuery(args.projectUuid, body),
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
          dashboardUuid: args.dashboard.uuid,
          dashboardName: args.dashboard.name,
          tileUuid: args.tileUuid,
          savedSqlUuid: args.savedSqlUuid,
          chartSlug: args.props.chartSlug,
          chartName: args.props.chartName,
        },
        appliedDashboardFilters: args.filters,
      },
      {
        profile: args.profile,
        projectUuid: args.projectUuid,
        projectPinned: args.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: [
          ...filterOverrideWarnings(args.filterWarnings),
          SQL_TILE_ROW_LEVEL_WARNING,
          ...(args.dateZoomIgnored ? [DATE_ZOOM_IGNORED_ON_SQL_TILE] : []),
          ...bounded.warnings,
        ],
      },
    ),
  );
}

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
              if (err instanceof ResultLimitError) {
                return codedErrorResult(err.code, err.message);
              }
              return projectScopeErrorResult(err);
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
        'Execute one dashboard tile in dashboard context (saved semantic charts or saved SQL tiles). Cache-first, bounded rows.',
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
              const tileType = typeof tile.type === 'string' ? tile.type : 'unknown';
              const props = asRecord(tile.properties);
              const classified = classifyDashboardTile(tileType, props);
              if (classified.kind === 'not_executable') {
                return codedErrorResult(
                  'CONTENT_NOT_EXECUTABLE',
                  classified.reason === 'missing_saved_sql_uuid'
                    ? 'Tile has no saved SQL UUID'
                    : `Tile type '${classified.tileType}' is not executable`,
                );
              }
              const { filters, warnings: filterWarnings } = applyFilterValueOverrides(
                dashboard.filters as DashboardFiltersLike | undefined,
                args.filterOverrides,
              );
              const shared: DashboardTileSharedArgs = {
                client: c,
                profile,
                projectUuid: scope.projectUuid,
                projectPinned: scope.projectPinned,
                dashboard,
                tileUuid: args.tileUuid,
                props,
                filters,
                filterWarnings,
                limit,
                parameterOverrides: args.parameterOverrides,
                waitForResults: args.waitForResults,
                timeoutMs: args.timeoutMs,
              };
              switch (classified.kind) {
                case 'sql_chart':
                  return executeSqlDashboardTile({
                    ...shared,
                    savedSqlUuid: classified.savedSqlUuid,
                    dateZoomIgnored: args.dateZoom !== undefined,
                  });
                case 'saved_chart':
                  return executeSemanticDashboardTile({
                    ...shared,
                    dateZoom: args.dateZoom,
                  });
                default: {
                  const _exhaustive: never = classified;
                  return _exhaustive;
                }
              }
            } catch (err) {
              if (err instanceof ResultLimitError || err instanceof FilterOverrideError) {
                return codedErrorResult(err.code, err.message);
              }
              return projectScopeErrorResult(err);
            }
          },
      ),
  );
}

// ToolModule exports (profile mounts)
export const runChartTool = defineTool('run_chart', registerRunChart);
export const runDashboardTileTool = defineTool('run_dashboard_tile', registerRunDashboardTile);
