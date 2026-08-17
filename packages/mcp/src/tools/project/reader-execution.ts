/**
 * Saved-content execution tools for content-reader (semantic + opaque saved SQL).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { SAVED_EXECUTION_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { clampRowLimit } from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { runBoundedSavedQuery } from '../query/bounded-saved-query.js';
import {
  looksLikeUuid,
  sqlChartMatchFromId,
  type ChartSourceMatch,
} from '../query/chart-source.js';
import { applyFilterValueOverrides } from '../query/filter-overrides.js';
import { loadSavedChartOrOpaqueSql } from '../query/load-saved-chart.js';
import {
  codedErrorResult,
  isCoverageComplete,
  readerExecutionErrorResult,
  sqlExecutionRedactedWarning,
} from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import { detectChartType } from './reader-content.js';

import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type {
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ProfileId,
  components,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type DateZoom = components['schemas']['DateZoom'];
type ExecuteAsyncSqlChartRequestParams = components['schemas']['ExecuteAsyncSqlChartRequestParams'];
type ExecuteAsyncDashboardSqlChartRequestParams =
  components['schemas']['ExecuteAsyncDashboardSqlChartRequestParams'];

const dateZoomSchema = z
  .object({
    granularity: z.string().optional(),
    xAxisFieldId: z.string().optional(),
  })
  .optional();

type DashboardFiltersInput = {
  dimensions?: Array<Record<string, unknown>>;
  metrics?: Array<Record<string, unknown>>;
  tableCalculations?: Array<Record<string, unknown>>;
};

function buildSqlChartBody(
  chartUuidOrSlug: string,
  match: ChartSourceMatch,
  limit: number,
  parameters: Record<string, unknown> | undefined,
): ExecuteAsyncSqlChartRequestParams {
  const common = {
    limit,
    parameters: parameters as ExecuteAsyncSqlChartRequestParams['parameters'],
    invalidateCache: false,
    context: 'sqlChartView' as const,
  };
  if (match.uuid) {
    return { ...common, savedSqlUuid: match.uuid };
  }
  if (looksLikeUuid(chartUuidOrSlug)) {
    return { ...common, savedSqlUuid: chartUuidOrSlug };
  }
  return { ...common, slug: match.slug ?? chartUuidOrSlug };
}

type RunOpaqueSqlChartArgs = {
  client: LightdashClient;
  profile: ProfileId;
  projectUuid: string;
  projectPinned: boolean;
  chartUuidOrSlug: string;
  match: ChartSourceMatch;
  limit: number;
  parameters?: Record<string, unknown>;
  waitForResults?: boolean;
  timeoutMs?: number;
};

async function runOpaqueSqlChart(args: RunOpaqueSqlChartArgs) {
  const sqlBody = buildSqlChartBody(args.chartUuidOrSlug, args.match, args.limit, args.parameters);
  const sourceUuid = 'savedSqlUuid' in sqlBody ? sqlBody.savedSqlUuid : sqlBody.slug;
  const bounded = await runBoundedSavedQuery({
    client: args.client,
    projectUuid: args.projectUuid,
    sourceType: 'chart',
    sourceUuid,
    limit: args.limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runSqlChartQuery(args.projectUuid, sqlBody),
  });
  if (!bounded.ok) {
    return bounded.result;
  }
  return jsonToolResult(
    contentReaderEnvelope(
      {
        ...bounded.normalized,
        content: {
          type: 'chart' as const,
          uuid: args.match.uuid ?? args.chartUuidOrSlug,
          name: args.match.name,
          chartType: 'sql' as const,
        },
        appliedParameters: args.parameters ?? {},
      },
      {
        profile: args.profile,
        projectUuid: args.projectUuid,
        projectPinned: args.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: [sqlExecutionRedactedWarning('chart'), ...bounded.warnings],
      },
    ),
  );
}

type RunChartArgs = {
  client: LightdashClient;
  profile: ProfileId;
  projectUuid?: string;
  chartUuidOrSlug: string;
  parameters?: Record<string, unknown>;
  limit?: number;
  pivotResults?: boolean;
  useCache?: boolean;
  waitForResults?: boolean;
  timeoutMs?: number;
};

function toOpaqueSqlChartArgs(
  args: RunChartArgs,
  scope: ResolvedProjectScope,
  match: ChartSourceMatch,
  limit: number,
): RunOpaqueSqlChartArgs {
  return {
    client: args.client,
    profile: args.profile,
    projectUuid: scope.projectUuid,
    projectPinned: scope.projectPinned,
    chartUuidOrSlug: args.chartUuidOrSlug,
    match,
    limit,
    parameters: args.parameters,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
  };
}

async function executeLoadedSavedChart(
  args: RunChartArgs,
  scope: ResolvedProjectScope,
  limit: number,
  chart: Record<string, unknown>,
) {
  const chartType = detectChartType(chart);
  if (chartType === 'sql') {
    return runOpaqueSqlChart(
      toOpaqueSqlChartArgs(
        args,
        scope,
        sqlChartMatchFromId(args.chartUuidOrSlug, {
          uuid: typeof chart.uuid === 'string' ? chart.uuid : undefined,
          slug: typeof chart.slug === 'string' ? chart.slug : undefined,
          name: typeof chart.name === 'string' ? chart.name : undefined,
        }),
        limit,
      ),
    );
  }
  if (chartType !== 'semantic') {
    return codedErrorResult('CONTENT_NOT_EXECUTABLE', 'Chart type is not executable');
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
    client: args.client,
    projectUuid: scope.projectUuid,
    sourceType: 'chart',
    sourceUuid: chartUuid,
    limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runChartQuery(scope.projectUuid, chartBody),
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
        profile: args.profile,
        projectUuid: scope.projectUuid,
        projectPinned: scope.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: bounded.warnings,
      },
    ),
  );
}

async function handleRunChart(args: RunChartArgs) {
  const scope = resolveProjectScope({ projectUuid: args.projectUuid });
  if (args.useCache === false) {
    return codedErrorResult(
      'INVALID_PARAMETER_OVERRIDE',
      'Cache bypass (useCache=false) is disabled in content-reader v1',
    );
  }
  const limit = clampRowLimit(args.limit);
  const loaded = await loadSavedChartOrOpaqueSql(
    args.client,
    scope.projectUuid,
    args.chartUuidOrSlug,
    { notFoundAsSql: true },
  );
  if (loaded.kind === 'sql') {
    return runOpaqueSqlChart(toOpaqueSqlChartArgs(args, scope, loaded.match, limit));
  }
  return executeLoadedSavedChart(args, scope, limit, loaded.chart);
}

export function registerRunChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'run_chart',
    {
      title: 'Run chart',
      description:
        'Execute one existing saved chart (semantic or opaque saved SQL). Cache-first, bounded rows. SQL text is never returned.',
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
              return await handleRunChart({ client: c, profile, ...args });
            } catch (err) {
              return readerExecutionErrorResult(err);
            }
          },
      ),
  );
}

type RunDashboardTileArgs = {
  client: LightdashClient;
  profile: ProfileId;
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
};

type DashboardTileRunCtx = {
  args: RunDashboardTileArgs;
  scope: ResolvedProjectScope;
  dashboard: Record<string, unknown>;
  props: Record<string, unknown>;
  filters: DashboardFiltersInput;
  filterWarningEntries: Array<{ code: 'FILTER_IGNORED'; message: string }>;
  limit: number;
};

async function runOpaqueDashboardSqlTile(ctx: DashboardTileRunCtx) {
  const { args, scope, dashboard, props, filters, filterWarningEntries, limit } = ctx;
  const savedSqlUuid = typeof props.savedSqlUuid === 'string' ? props.savedSqlUuid : '';
  const slug = typeof props.chartSlug === 'string' ? props.chartSlug : '';
  if (!savedSqlUuid && !slug) {
    return codedErrorResult('CONTENT_NOT_EXECUTABLE', 'SQL tile has no savedSqlUuid or chartSlug');
  }
  const sqlBody = {
    dashboardUuid: String(dashboard.uuid),
    tileUuid: args.tileUuid,
    dashboardFilters: filters as ExecuteAsyncDashboardSqlChartRequestParams['dashboardFilters'],
    dashboardSorts: [],
    parameters: args.parameterOverrides as ExecuteAsyncDashboardSqlChartRequestParams['parameters'],
    limit,
    invalidateCache: false,
    context: 'dashboardView' as const,
    ...(savedSqlUuid ? { savedSqlUuid } : { slug }),
  } satisfies ExecuteAsyncDashboardSqlChartRequestParams;

  const bounded = await runBoundedSavedQuery({
    client: args.client,
    projectUuid: scope.projectUuid,
    sourceType: 'dashboard_tile',
    sourceUuid: args.tileUuid,
    limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runDashboardSqlChartQuery(scope.projectUuid, sqlBody),
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
          chartUuid: savedSqlUuid || undefined,
          chartSlug: slug || undefined,
          chartName: props.chartName,
          chartType: 'sql' as const,
        },
        appliedDashboardFilters: filters,
      },
      {
        profile: args.profile,
        projectUuid: scope.projectUuid,
        projectPinned: scope.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: [
          ...filterWarningEntries,
          sqlExecutionRedactedWarning('dashboard_tile'),
          ...bounded.warnings,
        ],
      },
    ),
  );
}

async function runDashboardSavedChartTile(ctx: DashboardTileRunCtx) {
  const { args, scope, dashboard, props, filters, filterWarningEntries, limit } = ctx;
  const chartUuid = String(props.savedChartUuid ?? props.chartUuid ?? '');
  if (!chartUuid) {
    return codedErrorResult('CONTENT_NOT_EXECUTABLE', 'Tile has no saved chart UUID');
  }

  const body: ExecuteAsyncDashboardChartRequestParams = {
    dashboardUuid: String(dashboard.uuid),
    tileUuid: args.tileUuid,
    chartUuid,
    dashboardFilters: filters as ExecuteAsyncDashboardChartRequestParams['dashboardFilters'],
    dashboardSorts: [],
    parameters: args.parameterOverrides as ExecuteAsyncDashboardChartRequestParams['parameters'],
    dateZoom: args.dateZoom,
    limit,
    invalidateCache: false,
    context: 'dashboardView',
  };

  const bounded = await runBoundedSavedQuery({
    client: args.client,
    projectUuid: scope.projectUuid,
    sourceType: 'dashboard_tile',
    sourceUuid: args.tileUuid,
    limit,
    waitForResults: args.waitForResults,
    timeoutMs: args.timeoutMs,
    execute: () => args.client.v2.query.runDashboardChartQuery(scope.projectUuid, body),
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
        profile: args.profile,
        projectUuid: scope.projectUuid,
        projectPinned: scope.projectPinned,
        complete: isCoverageComplete(bounded.normalized),
        truncated: bounded.normalized.truncated,
        warnings: [...filterWarningEntries, ...bounded.warnings],
      },
    ),
  );
}

async function handleRunDashboardTile(args: RunDashboardTileArgs) {
  const scope = resolveProjectScope({ projectUuid: args.projectUuid });
  if (args.useCache === false) {
    return codedErrorResult(
      'INVALID_PARAMETER_OVERRIDE',
      'Cache bypass (useCache=false) is disabled in content-reader v1',
    );
  }
  const limit = clampRowLimit(args.limit);
  const dashboard = asRecord(
    await args.client.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
  );
  const tiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
  const tile = tiles.map((t) => asRecord(t)).find((t) => String(t.uuid) === args.tileUuid);
  if (!tile) {
    return codedErrorResult('CONTENT_NOT_FOUND', `Tile '${args.tileUuid}' not found on dashboard`);
  }
  const tileType = String(tile.type ?? 'unknown');
  const props = asRecord(tile.properties);
  const { filters, warnings: filterWarnings } = applyFilterValueOverrides(
    dashboard.filters as DashboardFiltersInput | undefined,
    args.filterOverrides,
  );
  const filterWarningEntries = filterWarnings.map((message) => ({
    code: 'FILTER_IGNORED' as const,
    message,
  }));

  const tileCtx: DashboardTileRunCtx = {
    args,
    scope,
    dashboard,
    props,
    filters,
    filterWarningEntries,
    limit,
  };
  if (tileType === 'sql_chart') {
    return runOpaqueDashboardSqlTile(tileCtx);
  }
  if (tileType !== 'saved_chart') {
    return codedErrorResult('CONTENT_NOT_EXECUTABLE', `Tile type '${tileType}' is not executable`);
  }
  return runDashboardSavedChartTile(tileCtx);
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
        'Execute one dashboard tile in dashboard context (semantic saved charts or opaque SQL tiles). SQL text is never returned.',
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
              return await handleRunDashboardTile({ client: c, profile, ...args });
            } catch (err) {
              return readerExecutionErrorResult(err);
            }
          },
      ),
  );
}

// ToolModule exports (profile mounts)
export const runChartTool = defineTool('run_chart', registerRunChart);
export const runDashboardTileTool = defineTool('run_dashboard_tile', registerRunDashboardTile);
