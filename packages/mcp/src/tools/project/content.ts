/**
 * Content, validation, and user-activity primitive tools.
 */

import { CONTENT_SORT_BY_COLUMNS } from '@lightdash-tools/common';
import { z } from 'zod';

import { resolveSearchProjectUuids } from '../../governance/available-projects.js';
import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { asPaginated, asRecord } from '../lib/api-shape.js';
import { emptyCoverage, isPageComplete } from '../lib/contracts.js';
import { registerOrgAuditTool } from '../lib/register-org-audit.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { resolveSessionOrganization } from '../organization/binding.js';
import { jsonToolResult, wrapTool } from '../shared.js';
import { defineTool } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { LightdashApi } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

/** Allowlist dashboard metadata; omit filters and tile payloads by default. */
function toDashboardMeta(
  dashboard: Record<string, unknown>,
  includeTiles: boolean,
): Record<string, unknown> {
  const tiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : undefined;
  return {
    uuid: dashboard.uuid,
    name: dashboard.name,
    description: dashboard.description,
    slug: dashboard.slug,
    spaceUuid: dashboard.spaceUuid,
    projectUuid: dashboard.projectUuid,
    organizationUuid: dashboard.organizationUuid,
    updatedAt: dashboard.updatedAt,
    createdAt: dashboard.createdAt,
    pinnedListUuid: dashboard.pinnedListUuid,
    tileCount: tiles?.length,
    tiles: includeTiles ? tiles : undefined,
  };
}

export function registerListContent(server: McpServer, contextProvider: McpContextProvider): void {
  registerOrgAuditTool(
    server,
    'list_content',
    {
      title: 'List content',
      description: 'Unified content inventory via GET /api/v2/content',
      inputSchema: {
        projectUuids: z.array(z.string()).optional(),
        spaceUuids: z.array(z.string()).optional(),
        parentSpaceUuid: z.string().optional(),
        contentTypes: z.array(z.enum(['chart', 'dashboard', 'space'])).optional(),
        search: z.string().optional(),
        sortBy: z.enum(CONTENT_SORT_BY_COLUMNS).optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuids?: string[];
          spaceUuids?: string[];
          parentSpaceUuid?: string;
          contentTypes?: Array<'chart' | 'dashboard' | 'space'>;
          search?: string;
          sortBy?: LightdashApi.Content.ContentSortByColumns;
          sortDirection?: 'asc' | 'desc';
          page?: number;
          pageSize?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const pinned = getPinnedProjectUuid();
          const projectUuids = resolveSearchProjectUuids({
            pinned,
            explicit: args.projectUuids,
          });
          const result = await c.v2.content.searchContent({
            projectUuids,
            spaceUuids: args.spaceUuids,
            parentSpaceUuid: args.parentSpaceUuid,
            contentTypes: args.contentTypes,
            search: args.search,
            sortBy: args.sortBy,
            sortDirection: args.sortDirection,
            page: args.page,
            pageSize: args.pageSize,
          });
          const { data, pagination } = asPaginated<Record<string, unknown>>(result);
          const complete = isPageComplete(
            data.length,
            pagination?.totalResults,
            pagination?.totalPageCount,
            args.page ?? pagination?.page,
          );
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              totalResults: pagination?.totalResults,
              complete,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, pinned),
              projectUuids,
              complete,
              apiResolutions: [
                {
                  capability: 'content_inventory',
                  selectedVersion: 'v2',
                  method: 'GET',
                  pathTemplate: '/api/v2/content',
                  reason: 'v2_preferred',
                },
              ],
            },
            warnings: [],
          });
        },
    ),
  );
}

export function registerGetDashboardMeta(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'get_dashboard_meta',
    {
      title: 'Get dashboard metadata',
      description: 'Get dashboard metadata without executing queries or exposing filter values',
      inputSchema: {
        projectUuid: projectUuidField(),
        dashboardUuid: uuidOrSlugField('Dashboard UUID or slug'),
        includeTiles: z.boolean().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: { projectUuid: string; dashboardUuid: string; includeTiles?: boolean }) => {
          const session = await resolveSessionOrganization(c);
          const dashboard = await c.v2.dashboards.getDashboard(
            args.projectUuid,
            args.dashboardUuid,
          );
          return jsonToolResult({
            ...toDashboardMeta(asRecord(dashboard), args.includeTiles === true),
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids: [args.projectUuid],
              complete: true,
              apiResolutions: [
                {
                  capability: 'dashboard_metadata',
                  selectedVersion: 'v2',
                  method: 'GET',
                  pathTemplate: '/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}',
                  reason: 'v2_preferred',
                },
              ],
            },
            warnings:
              args.includeTiles === true
                ? [
                    {
                      code: 'REDACTED' as const,
                      message:
                        'Tile payloads may include chart configs; filters and row data are still omitted from the top-level meta allowlist',
                    },
                  ]
                : [],
          });
        },
    ),
  );
}

export function registerListValidationResults(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_validation_results',
    {
      title: 'List validation results',
      description: 'List current validation failures for a project (v2)',
      inputSchema: {
        projectUuid: projectUuidField(),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'errorType', 'name', 'source']).optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().optional(),
        includeChartConfigWarnings: z.boolean().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid: string;
          search?: string;
          sortBy?: 'createdAt' | 'errorType' | 'name' | 'source';
          sortDirection?: 'asc' | 'desc';
          page?: number;
          pageSize?: number;
          includeChartConfigWarnings?: boolean;
        }) => {
          const session = await resolveSessionOrganization(c);
          const result = await c.v2.validation.listValidationResults(args.projectUuid, {
            searchQuery: args.search,
            sortBy: args.sortBy,
            sortDirection: args.sortDirection,
            page: args.page,
            pageSize: args.pageSize,
            includeChartConfigWarnings: args.includeChartConfigWarnings,
          });
          const { data, pagination } = asPaginated<Record<string, unknown>>(result);
          const complete = isPageComplete(
            data.length,
            pagination?.totalResults,
            pagination?.totalPageCount,
            args.page ?? pagination?.page,
          );
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              totalResults: pagination?.totalResults,
              complete,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids: [args.projectUuid],
              complete,
              apiResolutions: [
                {
                  capability: 'validation_results',
                  selectedVersion: 'v2',
                  method: 'GET',
                  pathTemplate: '/api/v2/projects/{projectUuid}/validate',
                  reason: 'v2_preferred',
                },
              ],
            },
            warnings: [],
          });
        },
    ),
  );
}

export function registerGetProjectUserActivity(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'get_project_user_activity',
    {
      title: 'Get project user activity',
      description:
        'Usage evidence for a project (views, role counts). Prefer with list_content (sortBy views or last_updated_at); not a deletion list',
      inputSchema: {
        projectUuid: projectUuidField(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { projectUuid: string }) => {
      const session = await resolveSessionOrganization(c);
      const activity = await c.v1.analytics.getUserActivity(args.projectUuid);
      return jsonToolResult({
        ...activity,
        usageSemantics: 'activity_evidence',
        observationWindow: 'unknown',
        coverage: {
          ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
          projectUuids: [args.projectUuid],
          apiResolutions: [
            {
              capability: 'user_activity',
              selectedVersion: 'v1',
              method: 'GET',
              pathTemplate: '/api/v1/analytics/user-activity/{projectUuid}',
              reason: 'v2_unavailable',
            },
          ],
        },
        warnings: [
          {
            code: 'V1_FALLBACK',
            message:
              'No unused-content endpoint exists; treat low views as review signals, not deletion candidates',
          },
        ],
      });
    }),
  );
}

// ToolModule exports (profile mounts)
export const listContentTool = defineTool('list_content', registerListContent);
export const getDashboardMetaTool = defineTool('get_dashboard_meta', registerGetDashboardMeta);
export const listValidationResultsTool = defineTool(
  'list_validation_results',
  registerListValidationResults,
);
export const getProjectUserActivityTool = defineTool(
  'get_project_user_activity',
  registerGetProjectUserActivity,
);
