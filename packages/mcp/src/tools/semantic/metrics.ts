/**
 * MCP tools: metrics (list, get).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListMetrics(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'list_metrics',
    {
      title: 'List metrics',
      description:
        'List metrics in the project catalog. Search with goal keywords from the question, not warehouse table names (those often return zero). Filter results where tableName equals the explore id. projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        search: z.string().optional().describe('Metric keyword search (not warehouse/table label)'),
        page: z.number().int().positive().optional().describe('Page number (1-based)'),
        pageSize: z.number().int().positive().optional().describe('Page size'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          ...params
        }: {
          projectUuid?: string;
          search?: string;
          page?: number;
          pageSize?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const result = await c.v1.metrics.listMetrics(scope.projectUuid, params);
            return jsonToolResult(result);
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

export function registerGetMetric(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(
    server,
    'get_metric',
    {
      title: 'Get metric',
      description:
        'Get a metric by explore id (tableName) and metric name. tableName must be the full explore id, not the warehouse label. projectUuid optional when X-Lightdash-Project is set.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        tableName: z.string().describe('Full explore id (same as tableName on catalog rows)'),
        metricName: z.string().describe('Metric name'),
      },
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
          projectUuid?: string;
          tableName: string;
          metricName: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const result = await c.v1.metrics.getMetric(scope.projectUuid, tableName, metricName);
            return jsonToolResult(result);
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

// ToolModule exports (profile mounts)
export const listMetricsTool = defineTool('list_metrics', registerListMetrics);
export const getMetricTool = defineTool('get_metric', registerGetMetric);
