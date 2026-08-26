/**
 * Content-reader discovery/metadata tools: search, dashboard, chart.
 */

import { CONTENT_SORT_BY_COLUMNS } from '@lightdash-tools/common';
import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METADATA_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { asPaginated, asRecord } from '../lib/api-shape.js';
import {
  buildSqlArtifact,
  catalogEntry,
  contentReaderArtifactUri,
  includeArtifactsField,
  parseIncludeArtifacts,
} from '../lib/artifacts.js';
import { isPageComplete } from '../lib/contracts.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { classifyChartSource } from '../query/chart-source.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { resolveSavedSqlChart } from '../query/resolve-saved-sql-chart.js';
import { artifactToolResult, jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { SqlChart } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

export function detectChartType(chart: Record<string, unknown>): 'semantic' | 'sql' | 'unknown' {
  if (chart.metricQuery && typeof chart.metricQuery === 'object') {
    return 'semantic';
  }
  const config = chart.chartConfig as { type?: string } | undefined;
  if (config?.type === 'sql' || typeof chart.sql === 'string') {
    return 'sql';
  }
  return 'unknown';
}

export type DashboardTileClass =
  | {
      kind: 'not_executable';
      reason: 'missing_saved_sql_uuid' | 'unsupported_type';
      tileType: string;
    }
  | { kind: 'saved_chart' }
  | { kind: 'sql_chart'; savedSqlUuid: string };

/** Shared execute/discovery rule: semantic tiles by type; SQL tiles need savedSqlUuid. */
export function classifyDashboardTile(
  type: string,
  props: Record<string, unknown>,
): DashboardTileClass {
  if (type === 'saved_chart') {
    return { kind: 'saved_chart' };
  }
  if (type === 'sql_chart') {
    const savedSqlUuid = props.savedSqlUuid;
    if (typeof savedSqlUuid === 'string' && savedSqlUuid.length > 0) {
      return { kind: 'sql_chart', savedSqlUuid };
    }
    return { kind: 'not_executable', tileType: type, reason: 'missing_saved_sql_uuid' };
  }
  return { kind: 'not_executable', tileType: type, reason: 'unsupported_type' };
}

/** Pass through OpenAPI TableCalculation fields agents need to clone. */
export function toReaderTableCalculation(tc: unknown): Record<string, unknown> {
  const row = (tc ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {
    name: row.name,
    displayName: row.displayName,
  };
  if (row.type !== undefined) {
    out.type = row.type;
  }
  if (row.format !== undefined) {
    out.format = row.format;
  }
  if (row.totalMode !== undefined) {
    out.totalMode = row.totalMode;
  }
  if (row.index !== undefined) {
    out.index = row.index;
  }
  if (row.formula !== undefined) {
    out.formula = row.formula;
  }
  if (row.sql !== undefined) {
    out.sql = row.sql;
  }
  if (row.template !== undefined) {
    out.template = row.template;
  }
  return out;
}

/* eslint-disable-next-line sonarjs/cyclomatic-complexity -- chart shape mapping */
function toReaderChart(chart: Record<string, unknown>, includeQuery: boolean) {
  const metricQuery = (chart.metricQuery ?? {}) as Record<string, unknown>;
  const chartType = detectChartType(chart);
  const dimensions = Array.isArray(metricQuery.dimensions)
    ? (metricQuery.dimensions as string[]).map((fieldId) => ({ fieldId }))
    : [];
  const metrics = Array.isArray(metricQuery.metrics)
    ? (metricQuery.metrics as string[]).map((fieldId) => ({ fieldId }))
    : [];
  const tableCalculations = includeQuery
    ? ((metricQuery.tableCalculations as unknown[]) ?? []).map(toReaderTableCalculation)
    : undefined;
  return {
    uuid: chart.uuid,
    slug: chart.slug,
    name: chart.name,
    description: chart.description,
    chartType,
    chartKind: (chart.chartConfig as { type?: string } | undefined)?.type,
    tableName: chart.tableName,
    dimensions: includeQuery ? dimensions : undefined,
    metrics: includeQuery ? metrics : undefined,
    tableCalculations,
    filters: includeQuery ? metricQuery.filters : undefined,
    sorts: includeQuery ? metricQuery.sorts : undefined,
    limit: includeQuery ? metricQuery.limit : undefined,
    parameters: chart.parameters ?? {},
    verification: chart.verification,
    updatedAt: chart.updatedAt,
    warnings:
      chartType === 'sql' ? ['SQL text is hidden; SQL chart execution is disabled by default'] : [],
  };
}

/** Metadata summary for a saved SQL chart — never includes the authored SQL body. */
export function toReaderSqlChartSummary(chart: SqlChart): Record<string, unknown> {
  return {
    uuid: chart.savedSqlUuid,
    savedSqlUuid: chart.savedSqlUuid,
    slug: chart.slug,
    name: chart.name,
    description: chart.description,
    chartType: 'sql' as const,
    chartKind: chart.chartKind,
    limit: chart.limit,
    space: chart.space,
    updatedAt: chart.lastUpdatedAt,
    executable: false,
  };
}

export function toReaderDashboard(
  dashboard: Record<string, unknown>,
  includeTiles: boolean,
): {
  description: unknown;
  filters: unknown;
  name: unknown;
  parameters: unknown;
  slug: unknown;
  space: { name: unknown; uuid: unknown };
  tabs: unknown;
  tiles:
    | Array<{
        chartKind: unknown;
        chartName: unknown;
        chartSlug: unknown;
        chartUuid: unknown;
        executable: boolean;
        savedSqlUuid: unknown;
        tabUuid: unknown;
        tileUuid: unknown;
        title: unknown;
        type: string;
      }>
    | undefined;
  updatedAt: unknown;
  uuid: unknown;
  verification: unknown;
  views: unknown;
} {
  const tilesRaw = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
  const tiles = includeTiles
    ? tilesRaw.map((tile) => {
        const t = tile as Record<string, unknown>;
        const props = (t.properties ?? {}) as Record<string, unknown>;
        const type = typeof t.type === 'string' ? t.type : 'unknown';
        return {
          tileUuid: t.uuid,
          tabUuid: t.tabUuid,
          type,
          title: props.title ?? props.chartName,
          chartUuid: props.savedChartUuid ?? props.chartUuid,
          savedSqlUuid: props.savedSqlUuid,
          chartSlug: props.chartSlug,
          chartName: props.chartName,
          chartKind: props.chartKind,
          executable: classifyDashboardTile(type, props).kind !== 'not_executable',
        };
      })
    : undefined;
  return {
    uuid: dashboard.uuid,
    slug: dashboard.slug,
    name: dashboard.name,
    description: dashboard.description,
    space: { uuid: dashboard.spaceUuid, name: dashboard.spaceName },
    verification: dashboard.verification,
    views: dashboard.views,
    updatedAt: dashboard.updatedAt,
    tabs: dashboard.tabs,
    filters: dashboard.filters,
    parameters: dashboard.parameters ?? {},
    tiles,
  };
}

export function registerSearchContent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'search_content',
    {
      title: 'Search content',
      description: 'Search charts, dashboards, spaces, and data apps in the resolved project',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        query: z.string().optional(),
        contentTypes: z.array(z.enum(['chart', 'dashboard', 'space', 'data_app'])).optional(),
        spaceUuids: z.array(z.string()).optional(),
        parentSpaceUuid: z.string().optional(),
        sortBy: z.enum(CONTENT_SORT_BY_COLUMNS).optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            query?: string;
            contentTypes?: Array<'chart' | 'dashboard' | 'data_app' | 'space'>;
            spaceUuids?: string[];
            parentSpaceUuid?: string;
            sortBy?: (typeof CONTENT_SORT_BY_COLUMNS)[number];
            sortDirection?: 'asc' | 'desc';
            page?: number;
            pageSize?: number;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              const pageSize = args.pageSize ?? 25;
              const result = await c.v2.content.searchContent({
                projectUuids: [scope.projectUuid],
                spaceUuids: args.spaceUuids,
                parentSpaceUuid: args.parentSpaceUuid,
                contentTypes: args.contentTypes,
                search: args.query,
                sortBy: args.sortBy,
                sortDirection: args.sortDirection,
                page: args.page,
                pageSize,
              });
              const { data, pagination } = asPaginated<Record<string, unknown>>(result);
              const complete = isPageComplete(
                data.length,
                pagination?.totalResults,
                pagination?.totalPageCount,
                args.page ?? pagination?.page,
              );
              return jsonToolResult(
                contentReaderEnvelope(
                  { items: data, pagination: { returned: data.length, ...pagination, complete } },
                  {
                    profile,
                    projectUuid: scope.projectUuid,
                    projectPinned: scope.projectPinned,
                    complete,
                    truncated: !complete,
                  },
                ),
              );
            } catch (err) {
              return projectScopeErrorResult(err);
            }
          },
      ),
  );
}

export function registerListVerifiedContent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'list_verified_content',
    {
      title: 'List verified content',
      description:
        'List admin-verified charts and dashboards in the resolved project (prefer these as trusted seeds)',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
      },
    },
    (profile) =>
      wrapTool(contextProvider, (c) => async (args: { projectUuid?: string }) => {
        try {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const items = await c.v1.projects.listVerifiedContent(scope.projectUuid);
          return jsonToolResult(
            contentReaderEnvelope(
              { items },
              {
                profile,
                projectUuid: scope.projectUuid,
                projectPinned: scope.projectPinned,
                complete: true,
                truncated: false,
              },
            ),
          );
        } catch (err) {
          return projectScopeErrorResult(err);
        }
      }),
  );
}

export function registerGetDashboard(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'get_dashboard',
    {
      title: 'Get dashboard',
      description: 'Inspect dashboard structure before tile execution',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        includeTiles: z.boolean().optional(),
        includeFilterDefinitions: z.boolean().optional(),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            dashboardUuidOrSlug: string;
            includeTiles?: boolean;
            includeFilterDefinitions?: boolean;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              const dashboard = asRecord(
                await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
              );
              const normalized = toReaderDashboard(dashboard, args.includeTiles !== false);
              if (args.includeFilterDefinitions === false) {
                delete (normalized as { filters?: unknown }).filters;
              }
              return jsonToolResult(
                contentReaderEnvelope(normalized, {
                  profile,
                  projectUuid: scope.projectUuid,
                  projectPinned: scope.projectPinned,
                }),
              );
            } catch (err) {
              return projectScopeErrorResult(err);
            }
          },
      ),
  );
}

export function registerGetChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'get_chart',
    {
      title: 'Get chart',
      description:
        'Explain a saved chart definition. Semantic charts return query fields when includeQueryDefinition. Saved SQL charts return metadata; pass includeArtifacts=["sql"] for the authored SQL body as a separate MCP resource (never inlined in the summary). Standalone SQL execution stays disabled.',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuidOrSlug: uuidOrSlugField('Chart UUID or slug'),
        includeQueryDefinition: z.boolean().optional(),
        includeArtifacts: includeArtifactsField(),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            chartUuidOrSlug: string;
            includeQueryDefinition?: boolean;
            includeArtifacts?: Array<'data' | 'sql'>;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              const include = parseIncludeArtifacts(args.includeArtifacts, []);
              const preClass = await classifyChartSource(
                c,
                scope.projectUuid,
                args.chartUuidOrSlug,
              );
              if (preClass === 'sql') {
                const sqlChart = await resolveSavedSqlChart(
                  c,
                  scope.projectUuid,
                  args.chartUuidOrSlug,
                );
                const sqlUri = contentReaderArtifactUri('sql', sqlChart.savedSqlUuid);
                const includeSql = include.has('sql');
                const warnings: ContentReaderWarning[] = includeSql
                  ? []
                  : [
                      {
                        code: 'SQL_ARTIFACT_AVAILABLE',
                        message:
                          'Authored SQL is available; pass includeArtifacts=["sql"] to attach it as a separate resource part',
                      },
                    ];
                const envelope = contentReaderEnvelope(toReaderSqlChartSummary(sqlChart), {
                  profile,
                  projectUuid: scope.projectUuid,
                  projectPinned: scope.projectPinned,
                  warnings,
                });
                return artifactToolResult({
                  summary: envelope as unknown as Record<string, unknown>,
                  artifacts: includeSql
                    ? [
                        buildSqlArtifact({
                          savedSqlUuid: sqlChart.savedSqlUuid,
                          sql: sqlChart.sql,
                          forModel: true,
                        }),
                      ]
                    : [],
                  catalog: [catalogEntry('sql', sqlUri, 'text/sql', includeSql)],
                });
              }
              const chart = asRecord(
                await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuidOrSlug),
              );
              return jsonToolResult(
                contentReaderEnvelope(toReaderChart(chart, args.includeQueryDefinition !== false), {
                  profile,
                  projectUuid: scope.projectUuid,
                  projectPinned: scope.projectPinned,
                }),
              );
            } catch (err) {
              return projectScopeErrorResult(err);
            }
          },
      ),
  );
}

// ToolModule exports (profile mounts)
export const searchContentTool = defineTool('search_content', registerSearchContent);
export const listVerifiedContentTool = defineTool(
  'list_verified_content',
  registerListVerifiedContent,
);
export const getDashboardTool = defineTool('get_dashboard', registerGetDashboard);
export const getChartTool = defineTool('get_chart', registerGetChart);
