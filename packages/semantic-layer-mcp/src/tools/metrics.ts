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
      description: 'List metrics in a project data catalog',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        search: z.string().optional().describe('Search query'),
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
      description: 'Get a metric by table name and metric name from the data catalog',
      inputSchema: z.object({
        projectUuid: projectUuidField(),
        tableName: z.string().describe('Table name'),
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
