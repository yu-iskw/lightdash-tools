/**
 * Export a saved chart as a PNG snapshot for content-reader (ADR-0012).
 */

import { ChartImageSizeError } from '@lightdash-tools/client';

import { getToolAuditAuth } from '../../audit/tool-audit-context.js';
import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { ProjectScopeError, resolveProjectScope } from '../../governance/project-scope.js';
import { IMAGE_SNAPSHOT_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import {
  ResultLimitError,
  acquireQueryBudget,
  releaseQueryBudget,
} from '../../policy/result-limits.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { classifyChartSource } from '../query/chart-source.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { imageToolResult, wrapTool } from '../shared.js';

import { detectChartType } from './reader-content.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerExportChartImage(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'export_chart_image',
    {
      title: 'Export chart image',
      description:
        'Export one saved semantic chart as a PNG image (headless render). Use to see the visualization; use run_chart for numbers. Requires Lightdash headless browser. SQL charts return CONTENT_NOT_EXECUTABLE.',
      safety: IMAGE_SNAPSHOT_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuid: uuidOrSlugField('Chart UUID or slug'),
      },
    },
    (_profile) =>
      wrapTool(
        contextProvider,
        (c) => async (args: { projectUuid?: string; chartUuid: string }) => {
          const sessionId = getMcpClientSessionId();
          const userKey = getToolAuditAuth()?.subject;
          let budgetHeld = false;
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const preClass = await classifyChartSource(c, scope.projectUuid, args.chartUuid);
            if (preClass === 'sql') {
              return codedErrorResult(
                'CONTENT_NOT_EXECUTABLE',
                'Saved SQL chart image export is disabled by default on content-reader',
              );
            }
            const chart = asRecord(
              await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuid),
            );
            const chartType = detectChartType(chart);
            if (chartType !== 'semantic') {
              return codedErrorResult(
                'CONTENT_NOT_EXECUTABLE',
                chartType === 'sql'
                  ? 'Saved SQL chart image export is disabled by default on content-reader'
                  : 'Chart type is not exportable as an image snapshot',
              );
            }

            acquireQueryBudget(sessionId, userKey);
            budgetHeld = true;
            const png = await c.v1.charts.exportChartImagePng(args.chartUuid, scope.projectUuid);
            return imageToolResult({
              meta: {
                chartUuid: args.chartUuid,
                projectUuid: scope.projectUuid,
                mimeType: png.mimeType,
                byteLength: png.bytes.byteLength,
              },
              imageBase64: png.bytes.toString('base64'),
              mimeType: png.mimeType,
            });
          } catch (err) {
            if (err instanceof ChartImageSizeError) {
              return codedErrorResult(
                err.code,
                `${err.message}. Ask for a simpler chart or contact an admin.`,
              );
            }
            if (err instanceof ProjectScopeError) {
              return codedErrorResult(err.code, err.message);
            }
            if (err instanceof ResultLimitError) {
              return codedErrorResult(err.code, err.message);
            }
            throw err;
          } finally {
            if (budgetHeld) {
              releaseQueryBudget(sessionId, userKey);
            }
          }
        },
      ),
  );
}
