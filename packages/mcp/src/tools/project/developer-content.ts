/**
 * Content-developer authoring tools (ADR-0014).
 *
 * Hybrid authoring surface behind a hard preview -> validate -> apply gate:
 *  - preview_* computes an in-memory diff and issues a single-use previewId.
 *  - validate_* runs the upstream validator and marks the preview validated.
 *  - The write tools consume the validated preview (contentHash must match exactly)
 *    before calling the underlying create/update/upsert API.
 *
 * `preview_space_changes` doubles as the preview tool for `move_content` (pass
 * `itemUuids` + `targetSpaceUuid` instead of `spaceUuid` + `changes`) since there is
 * no dedicated content-move preview endpoint in the catalog.
 */

import { WRITE_IDEMPOTENT, WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';
import { z } from 'zod';

import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  COMPARE_SAFETY,
  PREVIEW_SAFETY,
  VALIDATE_SAFETY,
  WRITE_SAFETY,
  developerErrorResult,
  registerContentDeveloperTool,
} from '../../policy/content-developer.js';
import {
  addPreviewLedgerEntry,
  consumeValidatedPreview,
  markPreviewValidated,
} from '../../policy/preview-ledger.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import {
  applyTileAdd,
  applyTileMove,
  applyTileRemove,
  applyTileResize,
  buildDashboardUpdateBody,
  buildMoveContentItem,
  resolveCompareVersionIds,
  shallowDiff,
} from './developer-helpers.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type {
  components,
  CreateSpace,
  UpdateSpace,
  UpsertChartAsCodeBody,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type CreateDashboardBody =
  components['schemas']['CreateDashboard'] | components['schemas']['DuplicateDashboardParams'];
type UpdateDashboardBody = components['schemas']['UpdateDashboard'];
type BulkMoveContentBody = components['schemas']['ApiContentBulkActionBody_ContentActionMove_'];

const previewIdField = () =>
  z.string().describe('Single-use previewId from the matching preview_* tool');

function developerContext(scope: ResolvedProjectScope): {
  persona: 'content-developer';
  projectUuid: string;
  projectPinned: boolean;
} {
  return {
    persona: 'content-developer',
    projectUuid: scope.projectUuid,
    projectPinned: scope.projectPinned,
  };
}

// ── preview_* ────────────────────────────────────────────────────────────────

export function registerPreviewChartChanges(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'preview_chart_changes',
    {
      title: 'Preview chart changes',
      description:
        'Preview unsaved chart edits by diffing against the current saved definition; issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuidOrSlug: uuidOrSlugField('Chart UUID or slug').optional(),
        slug: z
          .string()
          .optional()
          .describe('Target slug when creating a new chart (defaults resourceKey)'),
        changes: z.record(z.string(), z.unknown()).describe('Proposed chart-as-code payload'),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          chartUuidOrSlug?: string;
          slug?: string;
          changes: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const current = args.chartUuidOrSlug
              ? asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuidOrSlug))
              : null;
            const resourceKey = args.slug ?? args.chartUuidOrSlug ?? 'new';
            const entry = addPreviewLedgerEntry({
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'chart',
              resourceKey,
              proposed: args.changes,
            });
            return jsonToolResult({
              data: {
                previewId: entry.previewId,
                status: entry.status,
                contentHash: entry.contentHash,
                resourceKey,
                expiresAt: entry.expiresAt,
                diff: shallowDiff(current, args.changes),
                current,
              },
              context: developerContext(scope),
            });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerPreviewDashboardChanges(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'preview_dashboard_changes',
    {
      title: 'Preview dashboard changes',
      description:
        'Preview unsaved dashboard edits by diffing against the current saved definition; issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug').optional(),
        changes: z.record(z.string(), z.unknown()).describe('Proposed dashboard fields'),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug?: string;
          changes: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const current = args.dashboardUuidOrSlug
              ? asRecord(
                  await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
                )
              : null;
            const resourceKey = args.dashboardUuidOrSlug ?? 'new';
            const entry = addPreviewLedgerEntry({
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey,
              proposed: args.changes,
            });
            return jsonToolResult({
              data: {
                previewId: entry.previewId,
                status: entry.status,
                contentHash: entry.contentHash,
                resourceKey,
                expiresAt: entry.expiresAt,
                diff: shallowDiff(current, args.changes),
                current,
              },
              context: developerContext(scope),
            });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerPreviewSpaceChanges(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'preview_space_changes',
    {
      title: 'Preview space changes',
      description:
        'Preview unsaved space edits (or a bulk content move via itemUuids + targetSpaceUuid); issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        spaceUuid: z.string().optional(),
        changes: z.record(z.string(), z.unknown()).optional().describe('Proposed space fields'),
        itemUuids: z
          .array(z.string())
          .optional()
          .describe(
            'Provide with targetSpaceUuid to preview a bulk content move (consumed by move_content) instead of a space edit',
          ),
        targetSpaceUuid: z.string().nullable().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          spaceUuid?: string;
          changes?: Record<string, unknown>;
          itemUuids?: string[];
          targetSpaceUuid?: string | null;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();

            if (args.itemUuids && args.itemUuids.length > 0) {
              const resourceKey = [...args.itemUuids].sort().join(',');
              const proposed = {
                itemUuids: args.itemUuids,
                targetSpaceUuid: args.targetSpaceUuid ?? null,
              };
              const entry = addPreviewLedgerEntry({
                sessionId,
                projectUuid: scope.projectUuid,
                resourceKind: 'content-move',
                resourceKey,
                proposed,
              });
              return jsonToolResult({
                data: {
                  previewId: entry.previewId,
                  status: entry.status,
                  contentHash: entry.contentHash,
                  resourceKey,
                  expiresAt: entry.expiresAt,
                  diff: shallowDiff({}, proposed),
                },
                context: developerContext(scope),
              });
            }

            const current = args.spaceUuid
              ? asRecord(await c.v1.spaces.getSpace(scope.projectUuid, args.spaceUuid))
              : null;
            const resourceKey = args.spaceUuid ?? 'new';
            const changes = args.changes ?? {};
            const entry = addPreviewLedgerEntry({
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'space',
              resourceKey,
              proposed: changes,
            });
            return jsonToolResult({
              data: {
                previewId: entry.previewId,
                status: entry.status,
                contentHash: entry.contentHash,
                resourceKey,
                expiresAt: entry.expiresAt,
                diff: shallowDiff(current, changes),
                current,
              },
              context: developerContext(scope),
            });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── validate_* ───────────────────────────────────────────────────────────────

export function registerValidateChart(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'validate_chart',
    {
      title: 'Validate chart',
      description: "Validate a saved chart's fields against its underlying explore",
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuid: z.string(),
        previewId: previewIdField().optional().describe('Marks the preview validated when set'),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { projectUuid?: string; chartUuid: string; previewId?: string }) => {
        try {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const validation = await c.v1.validation.validateChart(scope.projectUuid, args.chartUuid);
          let previewStatus: string | undefined;
          if (args.previewId) {
            const sessionId = getMcpClientSessionId();
            const entry = markPreviewValidated(args.previewId, sessionId, scope.projectUuid);
            previewStatus = entry.status;
          }
          return jsonToolResult({
            data: { validation, previewStatus },
            context: developerContext(scope),
          });
        } catch (err) {
          return developerErrorResult(err);
        }
      },
    ),
  );
}

export function registerValidateDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'validate_dashboard',
    {
      title: 'Validate dashboard',
      description: "Validate a saved dashboard's fields against its underlying explores",
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuid: z.string(),
        previewId: previewIdField().optional().describe('Marks the preview validated when set'),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { projectUuid?: string; dashboardUuid: string; previewId?: string }) => {
        try {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const validation = await c.v1.validation.validateDashboard(
            scope.projectUuid,
            args.dashboardUuid,
          );
          let previewStatus: string | undefined;
          if (args.previewId) {
            const sessionId = getMcpClientSessionId();
            const entry = markPreviewValidated(args.previewId, sessionId, scope.projectUuid);
            previewStatus = entry.status;
          }
          return jsonToolResult({
            data: { validation, previewStatus },
            context: developerContext(scope),
          });
        } catch (err) {
          return developerErrorResult(err);
        }
      },
    ),
  );
}

// ── compare_*_versions ───────────────────────────────────────────────────────

export function registerCompareChartVersions(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'compare_chart_versions',
    {
      title: 'Compare chart versions',
      description: 'Compare two chart version-history entries (defaults to the two most recent)',
      safety: COMPARE_SAFETY,
      inputSchema: {
        chartUuid: z.string(),
        versionUuidA: z.string().optional(),
        versionUuidB: z.string().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { chartUuid: string; versionUuidA?: string; versionUuidB?: string }) => {
        try {
          const { history } = await c.v1.charts.getChartHistory(args.chartUuid);
          const [idA, idB] = resolveCompareVersionIds(
            history,
            args.versionUuidA,
            args.versionUuidB,
          );
          const [a, b] = await Promise.all([
            c.v1.charts.getChartVersion(args.chartUuid, idA),
            c.v1.charts.getChartVersion(args.chartUuid, idB),
          ]);
          return jsonToolResult({ data: { a, b, diff: shallowDiff(a, b) } });
        } catch (err) {
          return developerErrorResult(err);
        }
      },
    ),
  );
}

export function registerCompareDashboardVersions(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'compare_dashboard_versions',
    {
      title: 'Compare dashboard versions',
      description:
        'Compare two dashboard version-history entries (defaults to the two most recent)',
      safety: COMPARE_SAFETY,
      inputSchema: {
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        versionUuidA: z.string().optional(),
        versionUuidB: z.string().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          dashboardUuidOrSlug: string;
          versionUuidA?: string;
          versionUuidB?: string;
        }) => {
          try {
            const { history } = await c.v1.dashboards.getDashboardHistory(args.dashboardUuidOrSlug);
            const [idA, idB] = resolveCompareVersionIds(
              history,
              args.versionUuidA,
              args.versionUuidB,
            );
            const [a, b] = await Promise.all([
              c.v1.dashboards.getDashboardVersion(args.dashboardUuidOrSlug, idA),
              c.v1.dashboards.getDashboardVersion(args.dashboardUuidOrSlug, idB),
            ]);
            return jsonToolResult({ data: { a, b, diff: shallowDiff(a, b) } });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── chart writes ─────────────────────────────────────────────────────────────

export function registerCreateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'create_chart',
    {
      title: 'Create chart',
      description: 'Create a chart from code representation after preview/validate',
      safety: WRITE_SAFETY,
      annotations: WRITE_IDEMPOTENT,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        slug: z.string(),
        previewId: previewIdField(),
        chart: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          slug: string;
          previewId: string;
          chart: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'chart',
              resourceKey: args.slug,
              proposed: args.chart,
            });
            const result = await c.v1.charts.upsertChartAsCode(
              scope.projectUuid,
              args.slug,
              args.chart as unknown as UpsertChartAsCodeBody,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerUpdateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'update_chart',
    {
      title: 'Update chart',
      description: 'Update a chart from code representation after preview/validate',
      safety: WRITE_SAFETY,
      annotations: WRITE_IDEMPOTENT,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        slug: z.string(),
        previewId: previewIdField(),
        chart: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          slug: string;
          previewId: string;
          chart: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'chart',
              resourceKey: args.slug,
              proposed: args.chart,
            });
            const result = await c.v1.charts.upsertChartAsCode(
              scope.projectUuid,
              args.slug,
              args.chart as unknown as UpsertChartAsCodeBody,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerDuplicateChart(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'duplicate_chart',
    {
      title: 'Duplicate chart',
      description:
        'Duplicate a chart by reading its as-code representation and upserting a new slug',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        sourceChartUuidOrSlug: uuidOrSlugField('Source chart UUID or slug'),
        newSlug: z.string(),
        newName: z.string().optional(),
        previewId: previewIdField(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          sourceChartUuidOrSlug: string;
          newSlug: string;
          newName?: string;
          previewId: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const proposed = {
              sourceChartUuidOrSlug: args.sourceChartUuidOrSlug,
              newSlug: args.newSlug,
              newName: args.newName,
            };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'chart',
              resourceKey: args.newSlug,
              proposed,
            });
            const list = await c.v1.charts.getChartsAsCode(scope.projectUuid, {
              ids: [args.sourceChartUuidOrSlug],
            });
            const source = list.charts[0];
            if (!source) {
              return codedErrorResult(
                'CONTENT_NOT_FOUND',
                `Chart '${args.sourceChartUuidOrSlug}' was not found`,
              );
            }
            const body = {
              ...source,
              slug: args.newSlug,
              name: args.newName ?? source.name,
            } as unknown as UpsertChartAsCodeBody;
            const result = await c.v1.charts.upsertChartAsCode(
              scope.projectUuid,
              args.newSlug,
              body,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── dashboard writes ─────────────────────────────────────────────────────────

export function registerCreateDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'create_dashboard',
    {
      title: 'Create dashboard',
      description: 'Create a new dashboard after preview/validate',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        dashboard: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          previewId: string;
          dashboard: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: 'new',
              proposed: args.dashboard,
            });
            const result = await c.v1.dashboards.createDashboard(
              scope.projectUuid,
              args.dashboard as unknown as CreateDashboardBody,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerUpdateDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'update_dashboard',
    {
      title: 'Update dashboard',
      description: 'Update a dashboard by UUID or slug after preview/validate',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        dashboard: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
          previewId: string;
          dashboard: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed: args.dashboard,
            });
            const result = await c.v2.dashboards.updateDashboard(
              scope.projectUuid,
              args.dashboardUuidOrSlug,
              args.dashboard as unknown as UpdateDashboardBody,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerDuplicateDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'duplicate_dashboard',
    {
      title: 'Duplicate dashboard',
      description: 'Duplicate a dashboard via duplicateFrom after preview',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        sourceDashboardUuid: z.string(),
        newName: z.string().optional(),
        spaceUuid: z.string().optional(),
        previewId: previewIdField(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          sourceDashboardUuid: string;
          newName?: string;
          spaceUuid?: string;
          previewId: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const proposed = { newName: args.newName, spaceUuid: args.spaceUuid };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.sourceDashboardUuid,
              proposed,
            });
            const body: CreateDashboardBody = {
              dashboardName: args.newName ?? 'Copy',
              dashboardDesc: '',
              ...(args.spaceUuid ? { spaceUuid: args.spaceUuid } : {}),
            } as unknown as CreateDashboardBody;
            const result = await c.v1.dashboards.createDashboard(scope.projectUuid, body, {
              duplicateFrom: args.sourceDashboardUuid,
            });
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── dashboard tile composition ───────────────────────────────────────────────

export function registerAddDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'add_dashboard_tile',
    {
      title: 'Add dashboard tile',
      description: 'Add a tile to a dashboard by composing the full tile array',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        tile: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
          previewId: string;
          tile: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const dashboard = asRecord(
              await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
            );
            const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
            const nextTiles = applyTileAdd(currentTiles, args.tile);
            const proposed = { tiles: nextTiles };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
            });
            const body = buildDashboardUpdateBody(dashboard, proposed);
            const updated = await c.v2.dashboards.updateDashboard(
              scope.projectUuid,
              args.dashboardUuidOrSlug,
              body as unknown as UpdateDashboardBody,
            );
            return jsonToolResult({ data: updated, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerMoveDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'move_dashboard_tile',
    {
      title: 'Move dashboard tile',
      description: 'Move a dashboard tile by composing the full tile array',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        tileUuid: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
          previewId: string;
          tileUuid: string;
          x?: number;
          y?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const dashboard = asRecord(
              await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
            );
            const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
            const nextTiles = applyTileMove(currentTiles, args.tileUuid, args.x, args.y);
            const proposed = { tiles: nextTiles };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
            });
            const body = buildDashboardUpdateBody(dashboard, proposed);
            const updated = await c.v2.dashboards.updateDashboard(
              scope.projectUuid,
              args.dashboardUuidOrSlug,
              body as unknown as UpdateDashboardBody,
            );
            return jsonToolResult({ data: updated, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerRemoveDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'remove_dashboard_tile',
    {
      title: 'Remove dashboard tile',
      description: 'Remove a dashboard tile by composing the full tile array',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        tileUuid: z.string(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
          previewId: string;
          tileUuid: string;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const dashboard = asRecord(
              await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
            );
            const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
            const nextTiles = applyTileRemove(currentTiles, args.tileUuid);
            const proposed = { tiles: nextTiles };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
            });
            const body = buildDashboardUpdateBody(dashboard, proposed);
            const updated = await c.v2.dashboards.updateDashboard(
              scope.projectUuid,
              args.dashboardUuidOrSlug,
              body as unknown as UpdateDashboardBody,
            );
            return jsonToolResult({ data: updated, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerResizeDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'resize_dashboard_tile',
    {
      title: 'Resize dashboard tile',
      description: 'Resize a dashboard tile by composing the full tile array',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        tileUuid: z.string(),
        w: z.number().optional(),
        h: z.number().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          dashboardUuidOrSlug: string;
          previewId: string;
          tileUuid: string;
          w?: number;
          h?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            const dashboard = asRecord(
              await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
            );
            const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
            const nextTiles = applyTileResize(currentTiles, args.tileUuid, args.w, args.h);
            const proposed = { tiles: nextTiles };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
            });
            const body = buildDashboardUpdateBody(dashboard, proposed);
            const updated = await c.v2.dashboards.updateDashboard(
              scope.projectUuid,
              args.dashboardUuidOrSlug,
              body as unknown as UpdateDashboardBody,
            );
            return jsonToolResult({ data: updated, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── space writes ─────────────────────────────────────────────────────────────

export function registerCreateSpace(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'create_space',
    {
      title: 'Create space',
      description: 'Create a space in a project after preview',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        space: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          previewId: string;
          space: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'space',
              resourceKey: 'new',
              proposed: args.space,
            });
            const result = await c.v1.spaces.createSpace(
              scope.projectUuid,
              args.space as unknown as CreateSpace,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

export function registerUpdateSpace(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'update_space',
    {
      title: 'Update space',
      description: 'Update a space in a project after preview',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        spaceUuid: z.string(),
        previewId: previewIdField(),
        space: z.record(z.string(), z.unknown()),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          spaceUuid: string;
          previewId: string;
          space: Record<string, unknown>;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'space',
              resourceKey: args.spaceUuid,
              proposed: args.space,
            });
            const result = await c.v1.spaces.updateSpace(
              scope.projectUuid,
              args.spaceUuid,
              args.space as unknown as UpdateSpace,
            );
            return jsonToolResult({ data: result, context: developerContext(scope) });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}

// ── content move ─────────────────────────────────────────────────────────────

const MOVE_CONTENT_TYPES = ['chart', 'dashboard', 'space', 'data_app'] as const;
const MOVE_CHART_SOURCES = ['dbt_explore', 'sql'] as const;

export function registerMoveContent(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'move_content',
    {
      title: 'Move content',
      description:
        'Move one or more charts, dashboards, or spaces to another space (preview via preview_space_changes)',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        itemUuids: z.array(z.string()).min(1),
        contentTypes: z
          .array(z.enum(MOVE_CONTENT_TYPES))
          .min(1)
          .describe('Content type for each entry in itemUuids, same length and order'),
        chartSources: z
          .array(z.enum(MOVE_CHART_SOURCES))
          .optional()
          .describe(
            'Chart source per chart entry in itemUuids (defaults to dbt_explore); ignored for non-chart items',
          ),
        targetSpaceUuid: z.string().nullable(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          previewId: string;
          itemUuids: string[];
          contentTypes: MoveContentType[];
          chartSources?: MoveChartSource[];
          targetSpaceUuid: string | null;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const sessionId = getMcpClientSessionId();
            if (args.itemUuids.length !== args.contentTypes.length) {
              throw new Error('itemUuids and contentTypes must have the same length');
            }
            const resourceKey = [...args.itemUuids].sort().join(',');
            const proposed = { itemUuids: args.itemUuids, targetSpaceUuid: args.targetSpaceUuid };
            consumeValidatedPreview({
              previewId: args.previewId,
              sessionId,
              projectUuid: scope.projectUuid,
              resourceKind: 'content-move',
              resourceKey,
              proposed,
            });
            const content = args.itemUuids.map((uuid, index) =>
              // eslint-disable-next-line security/detect-object-injection -- index bound by itemUuids.length
              buildMoveContentItem(uuid, args.contentTypes[index], args.chartSources?.[index]),
            );
            await c.v2.content.bulkMoveContent(scope.projectUuid, {
              action: { type: 'move', targetSpaceUuid: args.targetSpaceUuid },
              content,
            } as unknown as BulkMoveContentBody);
            return jsonToolResult({
              data: { moved: args.itemUuids.length, targetSpaceUuid: args.targetSpaceUuid },
              context: developerContext(scope),
            });
          } catch (err) {
            return developerErrorResult(err);
          }
        },
    ),
  );
}
