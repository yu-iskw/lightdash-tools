/**
 * Content-developer authoring tools (ADR-0014).
 *
 * Hybrid authoring surface behind a hard preview -> confirm -> apply gate:
 *  - preview_* computes an in-memory diff and issues a HMAC-signed previewToken (ADR-0019).
 *  - confirm_preview marks a preview validated for every write path (create, update,
 *    duplicate, tile ops, content-move); it never calls a Lightdash API.
 *  - validate_* is an optional saved-resource health check (upstream validator on a
 *    persisted uuid only); it does not unlock the preview.
 *  - The write tools verify the validated previewToken (contentHash must match exactly),
 *    then call the underlying create/update/upsert API.
 *
 * `confirm_preview` binds confirmation to the resource (`resourceKind`/`resourceKey`),
 * so a confirmed previewToken for one resource can never unlock a write against a
 * different one.
 *
 * `preview_content_move` is the preview tool for `move_content` (itemUuids +
 * targetSpaceUuid + required contentTypes).
 */

import { WRITE_IDEMPOTENT, WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';
import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  COMPARE_SAFETY,
  VALIDATE_SAFETY,
  WRITE_SAFETY,
  registerContentDeveloperTool,
} from '../../policy/content-developer.js';
import {
  PREVIEW_RESOURCE_KINDS,
  confirmPreviewToken,
  withValidatedPreviewApply,
} from '../../policy/preview-ledger.js';
import { isNotFoundError } from '../lib/api-errors.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult } from '../shared.js';
import { defineTool } from '../types.js';

import {
  MOVE_CHART_SOURCES,
  MOVE_CONTENT_TYPES,
  developerContext,
  findContentByUuid,
  wrapDeveloperHandler,
} from './developer-content-shared.js';
import {
  applyTileAdd,
  applyTileMove,
  applyTileRemove,
  applyTileResize,
  assertMoveContentLengths,
  baselineFromMoveContentManifest,
  baselineFromResource,
  buildDashboardUpdateBody,
  buildMoveContentItem,
  buildMoveContentProposal,
  buildMoveContentResourceKey,
  fetchChartBaselineOptional,
  resolveCompareVersionIds,
  resolveMoveContentManifest,
  shallowDiff,
} from './developer-helpers.js';
import {
  chartUpsertBodySchema,
  dashboardCreateBodySchema,
  dashboardTileSchema,
  dashboardUpdateBodySchema,
  normalizeDuplicateChartProposed,
  normalizeDuplicateDashboardProposed,
  parseChartUpsertBody,
  parseDashboardCreateBody,
  parseDashboardTile,
  parseDashboardUpdateBody,
} from './schemas/index.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { PreviewResourceKind } from '../../policy/preview-ledger.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { components, UpsertChartAsCodeBody } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type CreateDashboardBody =
  components['schemas']['CreateDashboard'] | components['schemas']['DuplicateDashboardParams'];
type DuplicateDashboardBody = components['schemas']['DuplicateDashboardParams'];
type UpdateDashboardBody = components['schemas']['UpdateDashboard'];
type BulkMoveContentBody = components['schemas']['ApiContentBulkActionBody_ContentActionMove_'];

const previewTokenField = () =>
  z.string().describe('HMAC-signed previewToken from the matching preview_* tool');

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
      description:
        'Optional health check on a saved chart UUID only (upstream has no unsaved-payload validator). Does not unlock preview apply — use confirm_preview.',
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuid: z.string(),
      },
    },
    wrapDeveloperHandler<{ projectUuid?: string; chartUuid: string }>(
      contextProvider,
      ({ client: c }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const validation = await c.v1.validation.validateChart(scope.projectUuid, args.chartUuid);
          const errorCount = Array.isArray(validation.errors) ? validation.errors.length : 0;
          return jsonToolResult({
            data: { validation, errorCount },
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
      description:
        'Optional health check on a saved dashboard UUID only (upstream has no unsaved-payload validator). Does not unlock preview apply — use confirm_preview.',
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuid: z.string(),
      },
    },
    wrapDeveloperHandler<{ projectUuid?: string; dashboardUuid: string }>(
      contextProvider,
      ({ client: c }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const validation = await c.v1.validation.validateDashboard(
            scope.projectUuid,
            args.dashboardUuid,
          );
          const errorCount = Array.isArray(validation.errors) ? validation.errors.length : 0;
          return jsonToolResult({
            data: { validation, errorCount },
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
        'Confirm a previewed create/update/duplicate/tile/content-move payload; resourceKind/resourceKey must match the preview exactly. Required unlock before every write tool.',
      safety: VALIDATE_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewToken: previewTokenField(),
        resourceKind: z.enum(PREVIEW_RESOURCE_KINDS),
        resourceKey: z.string(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewToken: string;
      resourceKind: PreviewResourceKind;
      resourceKey: string;
    }>(contextProvider, ({ subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const entry = await confirmPreviewToken({
        previewToken: args.previewToken,
        subject,
        projectUuid: scope.projectUuid,
        resourceKind: args.resourceKind,
        resourceKey: args.resourceKey,
        serverContext,
      });
      return jsonToolResult({
        data: {
          previewToken: entry.previewToken,
          previewId: entry.claims.previewId,
          status: entry.claims.status,
        },
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
    }>(contextProvider, ({ client: c }) => async (args) => {
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
    }>(contextProvider, ({ client: c }) => async (args) => {
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
  previewToken: string;
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
        previewToken: previewTokenField(),
        chart: chartUpsertBodySchema,
      },
    },
    wrapDeveloperHandler<ChartUpsertArgs>(
      contextProvider,
      ({ client: c, subject, serverContext }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const parsedChart = parseChartUpsertBody(args.chart);
          if (!parsedChart.ok) {
            return codedErrorResult(parsedChart.code, parsedChart.message);
          }
          const proposed = parsedChart.data;
          // Re-read when possible so update baselines fail closed on intervening edits.
          // Creates (unknown slug) skip baseline; missing baseline on an update preview fails closed.
          const currentBaseline = await fetchChartBaselineOptional({
            chartUuidOrSlug: args.slug,
            getSavedChart: async (id) =>
              asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, id)),
            isNotFound: isNotFoundError,
          });
          return withValidatedPreviewApply(
            {
              previewToken: args.previewToken,
              subject,
              serverContext,
              projectUuid: scope.projectUuid,
              resourceKind: 'chart',
              resourceKey: args.slug,
              proposed,
              currentBaseline,
            },
            async () => {
              const result = await c.v1.charts.upsertChartAsCode(
                scope.projectUuid,
                args.slug,
                proposed as unknown as UpsertChartAsCodeBody,
              );
              return jsonToolResult({ data: result, context: developerContext(scope) });
            },
          );
        },
    ),
  );
}

export function registerCreateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerChartUpsertTool(server, contextProvider, {
    shortName: 'create_chart',
    title: 'Create chart',
    description: 'Create a chart from code representation after preview/confirm',
  });
}

export function registerUpdateChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerChartUpsertTool(server, contextProvider, {
    shortName: 'update_chart',
    title: 'Update chart',
    description: 'Update a chart from code representation after preview/confirm',
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
        'Duplicate a chart after a source-bound preview (preview_chart_changes on the source); newSlug must be free',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        sourceChartUuidOrSlug: uuidOrSlugField('Source chart UUID or slug'),
        newSlug: z.string(),
        newName: z.string().optional(),
        previewToken: previewTokenField(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      sourceChartUuidOrSlug: string;
      newSlug: string;
      newName?: string;
      previewToken: string;
    }>(contextProvider, ({ client: c, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const proposed = normalizeDuplicateChartProposed({
        sourceChartUuidOrSlug: args.sourceChartUuidOrSlug,
        newSlug: args.newSlug,
        newName: args.newName,
      });
      const getSaved = async (id: string) =>
        asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, id));
      let sourceRecord: Record<string, unknown>;
      try {
        sourceRecord = await getSaved(args.sourceChartUuidOrSlug);
      } catch (err) {
        if (isNotFoundError(err)) {
          return codedErrorResult(
            'CONTENT_NOT_FOUND',
            `Chart '${args.sourceChartUuidOrSlug}' was not found`,
          );
        }
        throw err;
      }
      const sourceBaselineBefore = baselineFromResource(sourceRecord);
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
      // Re-read after as-code so a mid-read source edit cannot slip past the preview baseline.
      let sourceRecordAfter: Record<string, unknown>;
      try {
        sourceRecordAfter = await getSaved(args.sourceChartUuidOrSlug);
      } catch (err) {
        if (isNotFoundError(err)) {
          return codedErrorResult(
            'CONTENT_NOT_FOUND',
            `Chart '${args.sourceChartUuidOrSlug}' was not found`,
          );
        }
        throw err;
      }
      const sourceBaseline = baselineFromResource(sourceRecordAfter);
      if (sourceBaselineBefore?.updatedAt !== sourceBaseline?.updatedAt) {
        return codedErrorResult(
          'PREVIEW_STALE',
          `Source chart '${args.sourceChartUuidOrSlug}' changed while reading as-code; re-run preview -> confirm`,
        );
      }
      const targetBaseline = await fetchChartBaselineOptional({
        chartUuidOrSlug: args.newSlug,
        getSavedChart: getSaved,
        isNotFound: isNotFoundError,
      });
      if (targetBaseline) {
        return codedErrorResult(
          'CHART_SLUG_EXISTS',
          `Chart slug '${args.newSlug}' already exists; choose a free newSlug or update the existing chart`,
        );
      }
      const resourceKey = sourceBaseline?.uuid ?? args.sourceChartUuidOrSlug;
      return withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'chart',
          resourceKey,
          proposed,
          currentBaseline: sourceBaseline,
        },
        async () => {
          const body = {
            ...source,
            slug: args.newSlug,
            name: args.newName ?? source.name,
          } as unknown as UpsertChartAsCodeBody;
          const result = await c.v1.charts.upsertChartAsCode(scope.projectUuid, args.newSlug, body);
          return jsonToolResult({ data: result, context: developerContext(scope) });
        },
      );
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
      description: 'Create a new dashboard after preview/confirm',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewToken: previewTokenField(),
        dashboard: dashboardCreateBodySchema,
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewToken: string;
      dashboard: Record<string, unknown>;
    }>(contextProvider, ({ client: c, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const parsedDashboard = parseDashboardCreateBody(args.dashboard);
      if (!parsedDashboard.ok) {
        return codedErrorResult(parsedDashboard.code, parsedDashboard.message);
      }
      const proposed = parsedDashboard.data;
      return withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'dashboard',
          resourceKey: 'new',
          proposed,
        },
        async () => {
          const result = await c.v1.dashboards.createDashboard(
            scope.projectUuid,
            proposed as unknown as CreateDashboardBody,
          );
          return jsonToolResult({ data: result, context: developerContext(scope) });
        },
      );
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
      description: 'Update a dashboard by UUID or slug after preview/confirm',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug'),
        previewToken: previewTokenField(),
        dashboard: dashboardUpdateBodySchema,
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      dashboardUuidOrSlug: string;
      previewToken: string;
      dashboard: Record<string, unknown>;
    }>(contextProvider, ({ client: c, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const parsedDashboard = parseDashboardUpdateBody(args.dashboard);
      if (!parsedDashboard.ok) {
        return codedErrorResult(parsedDashboard.code, parsedDashboard.message);
      }
      const proposed = parsedDashboard.data;
      const current = asRecord(
        await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
      );
      return withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'dashboard',
          resourceKey: args.dashboardUuidOrSlug,
          proposed,
          currentBaseline: baselineFromResource(current),
        },
        async () => {
          const result = await c.v2.dashboards.updateDashboard(
            scope.projectUuid,
            args.dashboardUuidOrSlug,
            proposed as unknown as UpdateDashboardBody,
          );
          return jsonToolResult({ data: result, context: developerContext(scope) });
        },
      );
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
      description:
        'Duplicate a dashboard via duplicateFrom after preview (stays in source space; relocate with move_content)',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        sourceDashboardUuid: z.string(),
        newName: z.string().optional(),
        previewToken: previewTokenField(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      sourceDashboardUuid: string;
      newName?: string;
      previewToken: string;
    }>(contextProvider, ({ client: c, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const proposed = normalizeDuplicateDashboardProposed({ newName: args.newName });
      const source = asRecord(
        await c.v2.dashboards.getDashboard(scope.projectUuid, args.sourceDashboardUuid),
      );
      const sourceBaseline = baselineFromResource(source);
      const resourceKey = sourceBaseline?.uuid ?? args.sourceDashboardUuid;
      return withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'dashboard',
          resourceKey,
          proposed,
          currentBaseline: sourceBaseline,
        },
        async () => {
          const sourceDesc = source.description;
          const body: DuplicateDashboardBody = {
            dashboardName: args.newName ?? 'Copy',
            dashboardDesc: typeof sourceDesc === 'string' ? sourceDesc : '',
          };
          const result = await c.v1.dashboards.createDashboard(scope.projectUuid, body, {
            duplicateFrom: args.sourceDashboardUuid,
          });
          return jsonToolResult({ data: result, context: developerContext(scope) });
        },
      );
    }),
  );
}

// ── dashboard tile composition ───────────────────────────────────────────────

type TileMutationArgs = {
  projectUuid?: string;
  dashboardUuidOrSlug: string;
  previewToken: string;
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
        previewToken: previewTokenField(),
        ...options.extraSchema,
      },
    },
    wrapDeveloperHandler<TArgs>(
      contextProvider,
      ({ client: c, subject, serverContext }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const dashboard = asRecord(
            await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
          );
          const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
          const nextTiles = options.computeNextTiles(currentTiles, args);
          const proposed = { tiles: nextTiles };
          return withValidatedPreviewApply(
            {
              previewToken: args.previewToken,
              subject,
              serverContext,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
              currentBaseline: baselineFromResource(dashboard),
            },
            async () => {
              const body = buildDashboardUpdateBody(dashboard, proposed);
              const updated = await c.v2.dashboards.updateDashboard(
                scope.projectUuid,
                args.dashboardUuidOrSlug,
                body as unknown as UpdateDashboardBody,
              );
              return jsonToolResult({ data: updated, context: developerContext(scope) });
            },
          );
        },
    ),
  );
}

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
        previewToken: previewTokenField(),
        tile: dashboardTileSchema,
      },
    },
    wrapDeveloperHandler<TileMutationArgs & { tile: Record<string, unknown> }>(
      contextProvider,
      ({ client: c, subject, serverContext }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const parsedTile = parseDashboardTile(args.tile);
          if (!parsedTile.ok) {
            return codedErrorResult(parsedTile.code, parsedTile.message);
          }
          const dashboard = asRecord(
            await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug),
          );
          const currentTiles = Array.isArray(dashboard.tiles) ? dashboard.tiles : [];
          const nextTiles = applyTileAdd(currentTiles, parsedTile.data);
          const proposed = { tiles: nextTiles };
          return withValidatedPreviewApply(
            {
              previewToken: args.previewToken,
              subject,
              serverContext,
              projectUuid: scope.projectUuid,
              resourceKind: 'dashboard',
              resourceKey: args.dashboardUuidOrSlug,
              proposed,
              currentBaseline: baselineFromResource(dashboard),
            },
            async () => {
              const body = buildDashboardUpdateBody(dashboard, proposed);
              const updated = await c.v2.dashboards.updateDashboard(
                scope.projectUuid,
                args.dashboardUuidOrSlug,
                body as unknown as UpdateDashboardBody,
              );
              return jsonToolResult({ data: updated, context: developerContext(scope) });
            },
          );
        },
    ),
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
        previewToken: previewTokenField(),
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
      previewToken: string;
      itemUuids: string[];
      contentTypes: MoveContentType[];
      chartSources?: MoveChartSource[];
      targetSpaceUuid: string | null;
    }>(contextProvider, ({ client: c, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      assertMoveContentLengths(args.itemUuids, args.contentTypes, args.chartSources);
      const resolved = await resolveMoveContentManifest({
        itemUuids: args.itemUuids,
        contentTypes: args.contentTypes,
        chartSources: args.chartSources,
        targetSpaceUuid: args.targetSpaceUuid,
        findContentByUuid: (uuid) => findContentByUuid(c, scope.projectUuid, uuid),
        getSpace: async (spaceUuid) =>
          asRecord(await c.v1.spaces.getSpace(scope.projectUuid, spaceUuid)),
        isNotFound: isNotFoundError,
      });
      if (resolved.kind === 'error') {
        return codedErrorResult(resolved.error.code, resolved.error.message);
      }
      const resourceKey = buildMoveContentResourceKey(args.itemUuids);
      const proposed = buildMoveContentProposal({
        itemUuids: args.itemUuids,
        targetSpaceUuid: args.targetSpaceUuid,
        contentTypes: args.contentTypes,
        chartSources: args.chartSources,
      });
      const currentBaseline = baselineFromMoveContentManifest(resolved.manifest);
      return withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'content-move',
          resourceKey,
          proposed,
          currentBaseline,
        },
        async () => {
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
        },
      );
    }),
  );
}

export const validateChartTool = defineTool('validate_chart', registerValidateChart);
export const validateDashboardTool = defineTool('validate_dashboard', registerValidateDashboard);
export const confirmPreviewTool = defineTool('confirm_preview', registerConfirmPreview);
export const compareChartVersionsTool = defineTool(
  'compare_chart_versions',
  registerCompareChartVersions,
);
export const compareDashboardVersionsTool = defineTool(
  'compare_dashboard_versions',
  registerCompareDashboardVersions,
);
export const createChartTool = defineTool('create_chart', registerCreateChart);
export const updateChartTool = defineTool('update_chart', registerUpdateChart);
export const duplicateChartTool = defineTool('duplicate_chart', registerDuplicateChart);
export const createDashboardTool = defineTool('create_dashboard', registerCreateDashboard);
export const updateDashboardTool = defineTool('update_dashboard', registerUpdateDashboard);
export const duplicateDashboardTool = defineTool('duplicate_dashboard', registerDuplicateDashboard);
export const addDashboardTileTool = defineTool('add_dashboard_tile', registerAddDashboardTile);
export const moveDashboardTileTool = defineTool('move_dashboard_tile', registerMoveDashboardTile);
export const removeDashboardTileTool = defineTool(
  'remove_dashboard_tile',
  registerRemoveDashboardTile,
);
export const resizeDashboardTileTool = defineTool(
  'resize_dashboard_tile',
  registerResizeDashboardTile,
);
export const moveContentTool = defineTool('move_content', registerMoveContent);
