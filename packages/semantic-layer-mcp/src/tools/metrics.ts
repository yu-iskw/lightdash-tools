/**
 * MCP tools: metrics (list, get).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { z } from 'zod';

import { projectUuidField } from './schema-fields.js';
import { jsonToolResult, wrapTool } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerMetricsTools(server: McpServer, contextProvider: McpContextProvider): void {
  server.registerTool(
    'list_metrics',
    {
      title: 'List metrics',
      description:
        'List metrics in the project catalog. Search with metric keywords (e.g. nps), not warehouse table names (those often return zero). Filter results where tableName equals the explore id.',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        search: z.string().optional().describe('Metric keyword search (not warehouse/table label)'),
        page: z.number().optional().describe('Page number'),
        pageSize: z.number().optional().describe('Page size'),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          ...params
        }: {
          projectUuid: string;
          search?: string;
          page?: number;
          pageSize?: number;
        }) => {
          const result = await c.v1.metrics.listMetrics(projectUuid, params);
          return jsonToolResult(result);
        },
    ),
  );

  server.registerTool(
    'get_metric',
    {
      title: 'Get metric',
      description:
        'Get a metric by explore id (tableName) and metric name. tableName must be the full explore id, not the warehouse label.',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        tableName: z.string().describe('Full explore id (same as tableName on catalog rows)'),
        metricName: z.string().describe('Metric name'),
      }),
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          tableName,
          metricName,
        }: {
          projectUuid: string;
          tableName: string;
          metricName: string;
        }) => {
          const result = await c.v1.metrics.getMetric(projectUuid, tableName, metricName);
          return jsonToolResult(result);
        },
    ),
  );
}
