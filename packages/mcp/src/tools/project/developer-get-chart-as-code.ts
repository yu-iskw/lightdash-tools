/**
 * Content-developer chart as-code discovery (ADR-0014).
 *
 * Returns upsert-shaped chart bodies for cloning chartConfig/metricQuery
 * before dashboard-scoped create — distinct from reader-shaped get_chart.
 */

import { resolveProjectScope } from '../../governance/project-scope.js';
import { DISCOVERY_SAFETY, registerContentDeveloperTool } from '../../policy/content-developer.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult } from '../shared.js';

import { developerContext, wrapDeveloperHandler } from './developer-content-shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerGetChartAsCode(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'get_chart_as_code',
    {
      title: 'Get chart as code',
      description:
        'Return a chart in as-code (upsert) shape for cloning chartConfig/metricQuery before dashboard-scoped create',
      safety: DISCOVERY_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuidOrSlug: uuidOrSlugField('Chart UUID or slug'),
      },
    },
    wrapDeveloperHandler<{ projectUuid?: string; chartUuidOrSlug: string }>(
      contextProvider,
      ({ client: c }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const list = await c.v1.charts.getChartsAsCode(scope.projectUuid, {
            ids: [args.chartUuidOrSlug],
          });
          const chart = list.charts[0];
          if (!chart) {
            return codedErrorResult(
              'CONTENT_NOT_FOUND',
              `Chart '${args.chartUuidOrSlug}' was not found as code`,
            );
          }
          return jsonToolResult({
            data: { chart },
            context: developerContext(scope),
          });
        },
    ),
  );
}
