/**
 * Deterministic metadata-based content explanation (no invented semantics).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METADATA_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { detectChartType } from '../project/reader-content.js';
import { loadSavedChartOrOpaqueSql } from '../query/load-saved-chart.js';
import {
  SQL_DEFINITION_BODY_REDACTED,
  projectScopeErrorResult,
} from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { ContentReaderWarning } from '../../policy/envelope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { ChartSourceMatch } from '../query/chart-source.js';
import type { ProfileId } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

function opaqueSqlExplanation(match: ChartSourceMatch) {
  const id = match.uuid ?? match.slug ?? 'sql-chart';
  return {
    identity: {
      uuid: match.uuid ?? id,
      name: match.name ?? id,
      type: 'chart' as const,
      chartType: 'sql' as const,
    },
    businessDescription: null,
    verification: { verified: false },
    measures: [],
    groupings: [],
    filters: [],
    parameters: [],
    timeContext: [],
    knownWarnings: ['SQL text is hidden; execution is opaque via lightdash_run_chart (ADR-0027)'],
    executionRequirements: [
      'lightdash_run_chart with chart UUID or slug (opaque saved SQL results)',
    ],
  };
}

function envelopeFor(
  profile: ProfileId,
  scope: ResolvedProjectScope,
  data: unknown,
  warnings?: ContentReaderWarning[],
) {
  return jsonToolResult(
    contentReaderEnvelope(data, {
      profile,
      projectUuid: scope.projectUuid,
      projectPinned: scope.projectPinned,
      warnings,
    }),
  );
}

async function explainChart(
  client: Parameters<typeof loadSavedChartOrOpaqueSql>[0],
  profile: ProfileId,
  scope: ResolvedProjectScope,
  contentUuidOrSlug: string,
) {
  const loaded = await loadSavedChartOrOpaqueSql(client, scope.projectUuid, contentUuidOrSlug, {
    notFoundAsSql: true,
  });
  if (loaded.kind === 'sql') {
    return envelopeFor(profile, scope, opaqueSqlExplanation(loaded.match), [
      SQL_DEFINITION_BODY_REDACTED,
    ]);
  }
  const chart = loaded.chart;
  const metricQuery = (chart.metricQuery ?? {}) as Record<string, unknown>;
  const verification = chart.verification as { verifiedAt?: string } | null;
  const chartType = detectChartType(chart);
  return envelopeFor(profile, scope, {
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
    measures: Array.isArray(metricQuery.metrics) ? (metricQuery.metrics as string[]) : [],
    groupings: Array.isArray(metricQuery.dimensions) ? (metricQuery.dimensions as string[]) : [],
    filters: metricQuery.filters ? ['saved filters present'] : [],
    parameters: chart.parameters ? Object.keys(asRecord(chart.parameters)) : [],
    timeContext: [],
    knownWarnings:
      chartType === 'sql'
        ? ['SQL text is hidden; execution is opaque via lightdash_run_chart (ADR-0027)']
        : [],
    executionRequirements: ['lightdash_run_chart with chart UUID or slug'],
  });
}

function explainDashboard(
  dashboard: Record<string, unknown>,
  profile: ProfileId,
  scope: ResolvedProjectScope,
) {
  const tiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
  const verification = dashboard.verification as { verifiedAt?: string } | null;
  return envelopeFor(profile, scope, {
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
    executionRequirements: ['lightdash_run_dashboard_tile with dashboard UUID and tile UUID'],
  });
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
      description: 'Produce a deterministic metadata-based explanation of a chart or dashboard',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        contentType: z.enum(['chart', 'dashboard']),
        contentUuidOrSlug: uuidOrSlugField('Content UUID or slug'),
      },
    },
    (profile) =>
      wrapTool(
        contextProvider,
        (c) =>
          async (args: {
            projectUuid?: string;
            contentType: 'chart' | 'dashboard';
            contentUuidOrSlug: string;
          }) => {
            try {
              const scope = resolveProjectScope({ projectUuid: args.projectUuid });
              if (args.contentType === 'chart') {
                return await explainChart(c, profile, scope, args.contentUuidOrSlug);
              }
              const dashboard = asRecord(
                await c.v2.dashboards.getDashboard(scope.projectUuid, args.contentUuidOrSlug),
              );
              return explainDashboard(dashboard, profile, scope);
            } catch (err) {
              return projectScopeErrorResult(err);
            }
          },
      ),
  );
}

// ToolModule exports (profile mounts)
export const explainContentTool = defineTool('explain_content', registerExplainContent);
