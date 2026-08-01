/**
 * Content-developer authoring tools (ADR-0014).
 *
 * Hybrid authoring surface behind a hard preview -> validate/confirm -> apply gate:
 *  - preview_* computes an in-memory diff and issues a single-use previewId.
 *  - validate_* runs the upstream validator against an existing chart/dashboard uuid and
 *    marks the preview validated only when it was bound to that exact resource.
 *  - confirm_preview marks a preview validated for flows with no upstream validate API
 *    (create, duplicate, tile ops, content-move); it never calls a Lightdash API.
 *  - The write tools consume the validated preview (contentHash must match exactly)
 *    before calling the underlying create/update/upsert API.
 *
 * `markPreviewValidated` binds validation to the resource it was actually run against
 * (`resourceKind`/`resourceKey`), so a validated/confirmed preview for one resource can
 * never unlock a write against a different one.
 *
 * `preview_content_move` is the preview tool for `move_content` (itemUuids +
 * targetSpaceUuid + required contentTypes).
 */

import { WRITE_IDEMPOTENT, WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';
import { z } from 'zod';

import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  COMPARE_SAFETY,
  VALIDATE_SAFETY,
  WRITE_SAFETY,
  registerContentDeveloperTool,
} from '../../policy/content-developer.js';
import { consumeValidatedPreview, markPreviewValidated } from '../../policy/preview-ledger.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult } from '../shared.js';

import {
  MOVE_CHART_SOURCES,
  MOVE_CONTENT_TYPES,
  developerContext,
  wrapDeveloperHandler,
} from './developer-content-shared.js';
import {
  applyTileAdd,
  applyTileMove,
  applyTileRemove,
  applyTileResize,
  assertMoveContentLengths,
  buildDashboardUpdateBody,
  buildMoveContentItem,
  buildMoveContentProposal,
  resolveCompareVersionIds,
  shallowDiff,
} from './developer-helpers.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { PreviewResourceKind } from '../../policy/preview-ledger.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { components, UpsertChartAsCodeBody } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

export {
  registerPreviewChartChanges,
  registerPreviewContentMove,
  registerPreviewDashboardChanges,
} from './developer-content-preview.js';

type CreateDashboardBody =
  components['schemas']['CreateDashboard'] | components['schemas']['DuplicateDashboardParams'];
type UpdateDashboardBody = components['schemas']['UpdateDashboard'];
type BulkMoveContentBody = components['schemas']['ApiContentBulkActionBody_ContentActionMove_'];

const previewIdField = () =>
  z.string().describe('Single-use previewId from the matching preview_* tool');

const PREVIEW_RESOURCE_KINDS = ['chart', 'content-move', 'dashboard'] as const;

// ── validate_* / confirm_preview ─────────────────────────────────────────────

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
        previewId: previewIdField()
          .optional()
          .describe('Marks the preview validated when it was bound to this chartUuid'),
      },
    },
    wrapDeveloperHandler<{ projectUuid?: string; chartUuid: string; previewId?: string }>(
      contextProvider,
      (c) => async (args) => {
        const scope = resolveProjectScope({ projectUuid: args.projectUuid });
        const validation = await c.v1.validation.validateChart(scope.projectUuid, args.chartUuid);
        let previewStatus: string | undefined;
        if (args.previewId) {
          const sessionId = getMcpClientSessionId();
          const entry = markPreviewValidated(args.previewId, sessionId, scope.projectUuid, {
            resourceKind: 'chart',
            resourceKey: args.chartUuid,
          });
          previewStatus = entry.status;
        }
        return jsonToolResult({
          data: { validation, previewStatus },
          context: developerContext(scope),
        });
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
        previewId: previewIdField()
          .optional()
          .describe('Marks the preview validated when it was bound to this dashboardUuid'),
      },
    },
    wrapDeveloperHandler<{ projectUuid?: string; dashboardUuid: string; previewId?: string }>(
      contextProvider,
      (c) => async (args) => {
        const scope = resolveProjectScope({ projectUuid: args.projectUuid });
        const validation = await c.v1.validation.validateDashboard(
          scope.projectUuid,
          args.dashboardUuid,
        );
        let previewStatus: string | undefined;
        if (args.previewId) {
          const sessionId = getMcpClientSessionId();
          const entry = markPreviewValidated(args.previewId, sessionId, scope.projectUuid, {
            resourceKind: 'dashboard',
            resourceKey: args.dashboardUuid,
          });
          previewStatus = entry.status;
        }
        return jsonToolResult({
          data: { validation, previewStatus },
          context: developerContext(scope),
        });
      },
    ),
  );
}

export function registerConfirmPreview(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'confirm_preview',
    {
      title: 'Confirm preview',
      description:
        'Confirm a previewed create/duplicate/tile/content-move payload (no upstream validate API); resourceKind/resourceKey must match the preview exactly',
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        resourceKind: z.enum(PREVIEW_RESOURCE_KINDS),
        resourceKey: z.string(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      resourceKind: PreviewResourceKind;
      resourceKey: string;
    }>(contextProvider, () => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const entry = markPreviewValidated(args.previewId, sessionId, scope.projectUuid, {
        resourceKind: args.resourceKind,
        resourceKey: args.resourceKey,
      });
      return jsonToolResult({
        data: { previewId: entry.previewId, status: entry.status },
        context: developerContext(scope),
      });
    }),
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
      description:
        'Compare two chart version-history entries within the resolved project scope (defaults to the two most recent)',
      safety: COMPARE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuid: z.string(),
        versionUuidA: z.string().optional(),
        versionUuidB: z.string().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      chartUuid: string;
      versionUuidA?: string;
      versionUuidB?: string;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuid);
      const { history } = await c.v1.charts.getChartHistory(args.chartUuid);
      const [idA, idB] = resolveCompareVersionIds(history, args.versionUuidA, args.versionUuidB);
      const [a, b] = await Promise.all([
        c.v1.charts.getChartVersion(args.chartUuid, idA),
        c.v1.charts.getChartVersion(args.chartUuid, idB),
      ]);
      return jsonToolResult({
        data: { a, b, diff: shallowDiff(a, b) },
        context: developerContext(scope),
      });
    }),
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
        'Compare two dashboard version-history entries within the resolved project scope (defaults to the two most recent)',
      safety: COMPARE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        versionUuidA: z.string().optional(),
        versionUuidB: z.string().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      dashboardUuidOrSlug: string;
      versionUuidA?: string;
      versionUuidB?: string;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug);
      const { history } = await c.v1.dashboards.getDashboardHistory(args.dashboardUuidOrSlug);
      const [idA, idB] = resolveCompareVersionIds(history, args.versionUuidA, args.versionUuidB);
      const [a, b] = await Promise.all([
        c.v1.dashboards.getDashboardVersion(args.dashboardUuidOrSlug, idA),
        c.v1.dashboards.getDashboardVersion(args.dashboardUuidOrSlug, idB),
      ]);
      return jsonToolResult({
        data: { a, b, diff: shallowDiff(a, b) },
        context: developerContext(scope),
      });
    }),
  );
}

// ── chart writes ─────────────────────────────────────────────────────────────

type ChartUpsertArgs = {
  projectUuid?: string;
  slug: string;
  previewId: string;
  chart: Record<string, unknown>;
};

/** Shared factory for create_chart/update_chart — both upsert the same as-code endpoint by slug. */
function registerChartUpsertTool(
  server: McpServer,
  contextProvider: McpContextProvider,
  options: { shortName: 'create_chart' | 'update_chart'; title: string; description: string },
): void {
  registerContentDeveloperTool(
    server,
    options.shortName,
    {
      title: options.title,
      description: options.description,
      safety: WRITE_SAFETY,
      annotations: WRITE_IDEMPOTENT,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        slug: z.string(),
        previewId: previewIdField(),
        chart: z.record(z.string(), z.unknown()),
      },
    },
    wrapDeveloperHandler<ChartUpsertArgs>(contextProvider, (c) => async (args) => {
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
    }),
  );
}

export function registerCreateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerChartUpsertTool(server, contextProvider, {
    shortName: 'create_chart',
    title: 'Create chart',
    description: 'Create a chart from code representation after preview/validate',
  });
}

export function registerUpdateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerChartUpsertTool(server, contextProvider, {
    shortName: 'update_chart',
    title: 'Update chart',
    description: 'Update a chart from code representation after preview/validate',
  });
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      sourceChartUuidOrSlug: string;
      newSlug: string;
      newName?: string;
      previewId: string;
    }>(contextProvider, (c) => async (args) => {
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
      const result = await c.v1.charts.upsertChartAsCode(scope.projectUuid, args.newSlug, body);
      return jsonToolResult({ data: result, context: developerContext(scope) });
    }),
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      dashboard: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
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
    }),
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      dashboardUuidOrSlug: string;
      previewId: string;
      dashboard: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
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
    }),
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      sourceDashboardUuid: string;
      newName?: string;
      spaceUuid?: string;
      previewId: string;
    }>(contextProvider, (c) => async (args) => {
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
    }),
  );
}

// ── dashboard tile composition ───────────────────────────────────────────────

type TileMutationArgs = {
  projectUuid?: string;
  dashboardUuidOrSlug: string;
  previewId: string;
};

/** Shared factory for the four tile tools — each composes the full tile array and PATCHes the dashboard. */
function registerTileMutationTool<TArgs extends TileMutationArgs>(
  server: McpServer,
  contextProvider: McpContextProvider,
  options: {
    shortName:
      | 'add_dashboard_tile'
      | 'move_dashboard_tile'
      | 'remove_dashboard_tile'
      | 'resize_dashboard_tile';
    title: string;
    description: string;
    extraSchema: Record<string, z.ZodType>;
    computeNextTiles: (currentTiles: unknown[], args: TArgs) => unknown[];
  },
): void {
  registerContentDeveloperTool(
    server,
    options.shortName,
    {
      title: options.title,
      description: options.description,
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewId: previewIdField(),
        ...options.extraSchema,
      },
    },
    wrapDeveloperHandler<TArgs>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const dashboard = asRecord(
        await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
      );
      const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
      const nextTiles = options.computeNextTiles(currentTiles, args);
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
    }),
  );
}

export function registerAddDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerTileMutationTool<TileMutationArgs & { tile: Record<string, unknown> }>(
    server,
    contextProvider,
    {
      shortName: 'add_dashboard_tile',
      title: 'Add dashboard tile',
      description: 'Add a tile to a dashboard by composing the full tile array',
      extraSchema: { tile: z.record(z.string(), z.unknown()) },
      computeNextTiles: (tiles, args) => applyTileAdd(tiles, args.tile),
    },
  );
}

export function registerMoveDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerTileMutationTool<TileMutationArgs & { tileUuid: string; x?: number; y?: number }>(
    server,
    contextProvider,
    {
      shortName: 'move_dashboard_tile',
      title: 'Move dashboard tile',
      description: 'Move a dashboard tile by composing the full tile array',
      extraSchema: { tileUuid: z.string(), x: z.number().optional(), y: z.number().optional() },
      computeNextTiles: (tiles, args) => applyTileMove(tiles, args.tileUuid, args.x, args.y),
    },
  );
}

export function registerRemoveDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerTileMutationTool<TileMutationArgs & { tileUuid: string }>(server, contextProvider, {
    shortName: 'remove_dashboard_tile',
    title: 'Remove dashboard tile',
    description: 'Remove a dashboard tile by composing the full tile array',
    extraSchema: { tileUuid: z.string() },
    computeNextTiles: (tiles, args) => applyTileRemove(tiles, args.tileUuid),
  });
}

export function registerResizeDashboardTile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerTileMutationTool<TileMutationArgs & { tileUuid: string; w?: number; h?: number }>(
    server,
    contextProvider,
    {
      shortName: 'resize_dashboard_tile',
      title: 'Resize dashboard tile',
      description: 'Resize a dashboard tile by composing the full tile array',
      extraSchema: { tileUuid: z.string(), w: z.number().optional(), h: z.number().optional() },
      computeNextTiles: (tiles, args) => applyTileResize(tiles, args.tileUuid, args.w, args.h),
    },
  );
}

// ── content move ─────────────────────────────────────────────────────────────

export function registerMoveContent(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'move_content',
    {
      title: 'Move content',
      description:
        'Move charts/dashboards into an existing space (preview via preview_content_move)',
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      itemUuids: string[];
      contentTypes: MoveContentType[];
      chartSources?: MoveChartSource[];
      targetSpaceUuid: string | null;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      assertMoveContentLengths(args.itemUuids, args.contentTypes, args.chartSources);
      const resourceKey = [...args.itemUuids].sort().join(',');
      const proposed = buildMoveContentProposal({
        itemUuids: args.itemUuids,
        targetSpaceUuid: args.targetSpaceUuid,
        contentTypes: args.contentTypes,
        chartSources: args.chartSources,
      });
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
    }),
  );
}
