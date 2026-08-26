/**
 * Deterministic metadata-based content explanation (no invented semantics).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METADATA_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { asRecord } from '../lib/api-shape.js';
import {
  includeArtifactsField,
  parseIncludeArtifacts,
  sqlRevealToolResult,
} from '../lib/artifacts.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { detectChartType, toReaderSqlChartSummary } from '../project/reader-content.js';
import { resolveChartSource } from '../query/chart-source.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { resolveSavedSqlChart } from '../query/resolve-saved-sql-chart.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

function sqlExplainSummary(args: {
  savedSqlUuid: string;
  name?: string;
  description?: string | null;
  slug?: string;
  space?: { uuid: string; name: string };
  lastUpdatedAt?: string | null;
  chartKind?: unknown;
  limit?: unknown;
}): object {
  return {
    identity: {
      uuid: args.savedSqlUuid,
      name: args.name,
      type: 'chart' as const,
    },
    businessDescription: args.description,
    verification: { verified: false },
    measures: [],
    groupings: [],
    filters: [],
    parameters: [],
    timeContext: [],
    knownWarnings: ['SQL chart; standalone execution disabled by default on content-reader'],
    executionRequirements: ['Not executable via run_chart on content-reader v1'],
    summary: toReaderSqlChartSummary(args),
  };
}

export function registerExplainContent(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'explain_content',
    {
      title: 'Explain content',
      description:
        'Produce a deterministic metadata-based explanation of a chart or dashboard. For saved SQL charts, pass includeArtifacts=["sql"] to attach the authored SQL body as a separate MCP resource.',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        contentType: z.enum(['chart', 'dashboard']),
        contentUuidOrSlug: uuidOrSlugField('Content UUID or slug'),
        includeArtifacts: includeArtifactsField(['sql']),
      },
    },
    /* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- explain branches */
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            contentType: 'chart' | 'dashboard';
            contentUuidOrSlug: string;
            includeArtifacts?: Array<'data' | 'sql'>;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              if (args.contentType === 'chart') {
                const include = parseIncludeArtifacts(args.includeArtifacts, []);
                const preClass = await resolveChartSource(
                  c,
                  scope.projectUuid,
                  args.contentUuidOrSlug,
                );
                if (preClass.class === 'sql') {
                  const savedSqlUuid = preClass.uuid ?? args.contentUuidOrSlug;
                  if (include.has('sql')) {
                    const sqlChart = await resolveSavedSqlChart(c, scope.projectUuid, savedSqlUuid);
                    return sqlRevealToolResult({
                      profile,
                      projectUuid: scope.projectUuid,
                      projectPinned: scope.projectPinned,
                      include,
                      savedSqlUuid: sqlChart.savedSqlUuid,
                      sql: sqlChart.sql,
                      summaryData: sqlExplainSummary(sqlChart),
                    });
                  }
                  return sqlRevealToolResult({
                    profile,
                    projectUuid: scope.projectUuid,
                    projectPinned: scope.projectPinned,
                    include,
                    savedSqlUuid,
                    summaryData: sqlExplainSummary({
                      savedSqlUuid,
                      name: preClass.name,
                      description: preClass.description,
                      slug: preClass.slug,
                      space: preClass.space,
                      lastUpdatedAt: preClass.lastUpdatedAt,
                    }),
                  });
                }
                const chart = asRecord(
                  await c.v2.charts.getSavedChart(scope.projectUuid, args.contentUuidOrSlug),
                );
                const metricQuery = (chart.metricQuery ?? {}) as Record<string, unknown>;
                const verification = chart.verification as { verifiedAt?: string } | null;
                const chartType = detectChartType(chart);
                const explanation = {
                  identity: {
                    uuid: chart.uuid,
                    name: chart.name,
                    type: 'chart' as const,
                  },
                  businessDescription: chart.description,
                  verification: {
                    verified: Boolean(verification?.verifiedAt),
                    verifiedAt: verification?.verifiedAt,
                  },
                  measures: Array.isArray(metricQuery.metrics)
                    ? (metricQuery.metrics as string[])
                    : [],
                  groupings: Array.isArray(metricQuery.dimensions)
                    ? (metricQuery.dimensions as string[])
                    : [],
                  filters: metricQuery.filters ? ['saved filters present'] : [],
                  parameters: chart.parameters ? Object.keys(asRecord(chart.parameters)) : [],
                  timeContext: [],
                  knownWarnings:
                    chartType === 'sql'
                      ? ['SQL chart; execution disabled by default on content-reader']
                      : [],
                  executionRequirements:
                    chartType === 'semantic'
                      ? ['lightdash_run_chart with chart UUID']
                      : ['Not executable on content-reader v1'],
                };
                return jsonToolResult(
                  contentReaderEnvelope(explanation, {
                    profile,
                    projectUuid: scope.projectUuid,
                    projectPinned: scope.projectPinned,
                  }),
                );
              }

              const dashboard = asRecord(
                await c.v2.dashboards.getDashboard(scope.projectUuid, args.contentUuidOrSlug),
              );
              const tiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
              const verification = dashboard.verification as { verifiedAt?: string } | null;
              const explanation = {
                identity: {
                  uuid: dashboard.uuid,
                  name: dashboard.name,
                  type: 'dashboard' as const,
                },
                businessDescription: dashboard.description,
                verification: {
                  verified: Boolean(verification?.verifiedAt),
                  verifiedAt: verification?.verifiedAt,
                },
                measures: [],
                groupings: [],
                filters: dashboard.filters ? ['dashboard filters present'] : [],
                parameters: dashboard.parameters ? Object.keys(asRecord(dashboard.parameters)) : [],
                timeContext: [],
                chartOrTileCount: tiles.length,
                knownWarnings: [],
                executionRequirements: [
                  'lightdash_run_dashboard_tile with dashboard UUID and tile UUID',
                ],
              };
              return jsonToolResult(
                contentReaderEnvelope(explanation, {
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
    /* eslint-enable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity */
  );
}

// ToolModule exports (profile mounts)
export const explainContentTool = defineTool('explain_content', registerExplainContent);
