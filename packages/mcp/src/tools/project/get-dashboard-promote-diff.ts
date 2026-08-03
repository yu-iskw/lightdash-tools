/**
 * Read-only dashboard promoteDiff tool (ADR-0017).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { summarizePromotionChanges } from '../../destructive/content-promote.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import { isNotFoundError } from '../lib/api-errors.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult, projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, registerToolSafe, wrapTool } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerGetDashboardPromoteDiff(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_dashboard_promote_diff',
    {
      title: 'Get dashboard promotion diff',
      description:
        'Read-only: fetch PromotionChanges for promoting a dashboard to its configured upstream project. Use before promote_dashboard.',
      annotations: READ_ONLY_DEFAULT,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
      },
    },
    wrapTool(
      contextProvider,
      (client) =>
        async ({
          projectUuid,
          dashboardUuidOrSlug,
        }: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid });
            const promoteDiff = await client.v1.dashboards.getDashboardPromoteDiff(
              dashboardUuidOrSlug,
              { projectUuid: scope.projectUuid },
            );
            return jsonToolResult({
              status: 'ok',
              projectUuid: scope.projectUuid,
              dashboardUuidOrSlug,
              summary: summarizePromotionChanges(promoteDiff),
              promoteDiff,
            });
          } catch (err) {
            if (isNotFoundError(err)) {
              return codedErrorResult(
                'CONTENT_NOT_FOUND',
                `dashboard '${dashboardUuidOrSlug}' was not found`,
              );
            }
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}
