/**
 * MCP tools: charts (list, charts-as-code list and upsert).
 */

import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import {
  READ_ONLY_CAPABILITY,
  READ_ONLY_DEFAULT,
  registerToolSafe,
  wrapToolAnnotated,
  WRITE_IDEMPOTENT,
  WRITE_IDEMPOTENT_CAPABILITY,
} from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerChartTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_charts',
    {
      title: 'List charts',
      description: 'List charts in a project (using charts-as-code API)',
      inputSchema: { projectUuid: projectUuidField() },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          const charts = await c.v1.charts.getChartsAsCode(projectUuid);
          return { content: [{ type: 'text', text: JSON.stringify(charts, null, 2) }] };
        },
    ),
  );
  registerToolSafe(
    server,
    'list_charts_as_code',
    {
      title: 'List charts as code',
      description: 'Get charts in code representation for a project (for charts-as-code workflows)',
      inputSchema: {
        projectUuid: projectUuidField(),
        ids: z.array(z.string()).optional().describe('Optional chart IDs (slugs) to filter'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapToolAnnotated(
      contextProvider,
      READ_ONLY_CAPABILITY,
      (c) =>
        async ({ projectUuid, ids }: { projectUuid: string; ids?: string[] }) => {
          const result = await c.v1.charts.getChartsAsCode(projectUuid, { ids });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
  registerToolSafe(
    server,
    'upsert_chart_as_code',
    {
      title: 'Upsert chart as code',
      description: 'Create or update a chart from its code representation (by slug)',
      inputSchema: {
        projectUuid: projectUuidField(),
        slug: z.string().describe('Chart slug'),
        chart: z
          .record(z.string(), z.unknown())
          .describe('Chart-as-code payload (name, metricQuery, chartConfig, etc.)'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapToolAnnotated(
      contextProvider,
      WRITE_IDEMPOTENT_CAPABILITY,
      (c) =>
        async ({
          projectUuid,
          slug,
          chart,
        }: {
          projectUuid: string;
          slug: string;
          chart: Record<string, unknown>;
        }) => {
          type UpsertChartBody = Parameters<
            LightdashClient['v1']['charts']['upsertChartAsCode']
          >[2];
          const result = await c.v1.charts.upsertChartAsCode(
            projectUuid,
            slug,
            chart as UpsertChartBody,
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );
}
