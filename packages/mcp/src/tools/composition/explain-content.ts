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
import { classifyChartSource } from '../query/chart-source.js';
import { codedErrorResult, projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

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
    /* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- explain branches */
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
                const preClass = await classifyChartSource(
                  c,
                  scope.projectUuid,
                  args.contentUuidOrSlug,
                );
                if (preClass === 'sql') {
                  return codedErrorResult(
                    'CONTENT_NOT_EXECUTABLE',
                    'Saved SQL chart definitions are not loaded via the semantic chart API on content-reader',
                  );
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
