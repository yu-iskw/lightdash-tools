/**
 * Content-developer preview_* tools (ADR-0014).
 *
 * Issues a single-use previewId via the session-scoped preview ledger.
 * `preview_content_move` previews bulk moves (`itemUuids` + `targetSpaceUuid` +
 * required `contentTypes`); space create/update is out of band (not on this persona).
 */

import { z } from 'zod';

import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import { PREVIEW_SAFETY, registerContentDeveloperTool } from '../../policy/content-developer.js';
import { addPreviewLedgerEntry, uniqueResourceKeys } from '../../policy/preview-ledger.js';
import { isNotFoundError } from '../lib/api-errors.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { codedErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult } from '../shared.js';

import {
  MOVE_CHART_SOURCES,
  MOVE_CONTENT_TYPES,
  developerContext,
  findContentByUuid,
  wrapDeveloperHandler,
} from './developer-content-shared.js';
import {
  assertMoveContentLengths,
  baselineFromMoveContentManifest,
  baselineFromResource,
  buildMoveContentProposal,
  buildMoveContentResourceKey,
  fetchChartBaselineOptional,
  resolveChartPreviewCurrent,
  resolveMoveContentManifest,
  shallowDiff,
} from './developer-helpers.js';
import {
  chartDuplicateChangesSchema,
  chartUpsertBodySchema,
  dashboardChangesBodySchema,
  isChartDuplicateChanges,
  isDashboardDuplicateChanges,
  parseChartDuplicateChanges,
  parseChartUpsertBody,
  parseDashboardChangesBody,
} from './schemas/index.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { TextContent } from '../shared.js';
import type { McpServer } from '@modelcontextprotocol/server';

type GetSavedChart = (id: string) => Promise<Record<string, unknown>>;

async function previewDuplicateChart(input: {
  changes: Record<string, unknown>;
  chartUuidOrSlug?: string;
  getSavedChart: GetSavedChart;
  sessionId: string;
  scope: ResolvedProjectScope;
}): Promise<TextContent> {
  const parsedDuplicate = parseChartDuplicateChanges(input.changes);
  if (!parsedDuplicate.ok) {
    return codedErrorResult(parsedDuplicate.code, parsedDuplicate.message);
  }
  const proposed = parsedDuplicate.data;
  const sourceId = input.chartUuidOrSlug;
  if (!sourceId) {
    return codedErrorResult(
      'INVALID_ARGUMENT',
      'chartUuidOrSlug is required for duplicate chart preview',
    );
  }
  if (sourceId !== proposed.sourceChartUuidOrSlug) {
    return codedErrorResult(
      'INVALID_ARGUMENT',
      'chartUuidOrSlug must equal changes.sourceChartUuidOrSlug for duplicate preview',
    );
  }
  // Concurrent lookups; prefer source errors so a target failure cannot mask CONTENT_NOT_FOUND.
  const [sourceSettled, targetSettled] = await Promise.allSettled([
    input.getSavedChart(sourceId),
    fetchChartBaselineOptional({
      chartUuidOrSlug: String(proposed.newSlug),
      getSavedChart: input.getSavedChart,
      isNotFound: isNotFoundError,
    }),
  ]);
  if (sourceSettled.status === 'rejected') {
    if (isNotFoundError(sourceSettled.reason)) {
      return codedErrorResult('CONTENT_NOT_FOUND', `Chart '${sourceId}' was not found`);
    }
    throw sourceSettled.reason;
  }
  if (targetSettled.status === 'rejected') {
    throw targetSettled.reason;
  }
  const current = sourceSettled.value;
  const targetBaseline = targetSettled.value;
  if (targetBaseline) {
    return codedErrorResult(
      'CHART_SLUG_EXISTS',
      `Chart slug '${String(proposed.newSlug)}' already exists; choose a free newSlug or update the existing chart`,
    );
  }
  const baseline = baselineFromResource(current);
  const resourceKey = baseline?.uuid ?? sourceId;
  const resourceAliases = uniqueResourceKeys(
    resourceKey,
    baseline?.uuid,
    baseline?.slug,
    sourceId,
    String(proposed.sourceChartUuidOrSlug),
  );
  const entry = await addPreviewLedgerEntry({
    sessionId: input.sessionId,
    projectUuid: input.scope.projectUuid,
    resourceKind: 'chart',
    resourceKey,
    resourceAliases,
    proposed,
    baseline,
  });
  return jsonToolResult({
    data: {
      previewId: entry.previewId,
      status: entry.status,
      contentHash: entry.contentHash,
      resourceKey,
      resourceAliases,
      operation: 'duplicate',
      expiresAt: entry.expiresAt,
      diff: shallowDiff(current, proposed),
      current,
    },
    context: developerContext(input.scope),
  });
}

async function previewUpsertChart(input: {
  changes: Record<string, unknown>;
  chartUuidOrSlug?: string;
  slug?: string;
  getSavedChart: GetSavedChart;
  sessionId: string;
  scope: ResolvedProjectScope;
}): Promise<TextContent> {
  const parsedChanges = parseChartUpsertBody(input.changes);
  if (!parsedChanges.ok) {
    return codedErrorResult(parsedChanges.code, parsedChanges.message);
  }
  const proposed = parsedChanges.data;
  const resolved = await resolveChartPreviewCurrent({
    chartUuidOrSlug: input.chartUuidOrSlug,
    slug: input.slug,
    getSavedChart: input.getSavedChart,
    isNotFound: isNotFoundError,
  });
  if (resolved.kind === 'error') {
    return codedErrorResult(resolved.code, resolved.message);
  }
  const current = resolved.current;
  const baseline = baselineFromResource(current);
  // Canonical identity is UUID when updating an existing chart; upsert slug remains an
  // alias so create/update_chart can consume by slug after confirm_preview.
  const upsertSlug =
    input.slug ?? (typeof current?.slug === 'string' ? current.slug : undefined) ?? undefined;
  const resourceKey = baseline?.uuid ?? upsertSlug ?? input.chartUuidOrSlug ?? input.slug ?? 'new';
  const resourceAliases = uniqueResourceKeys(
    resourceKey,
    baseline?.uuid,
    baseline?.slug,
    upsertSlug,
    input.chartUuidOrSlug,
    input.slug,
  );
  const entry = await addPreviewLedgerEntry({
    sessionId: input.sessionId,
    projectUuid: input.scope.projectUuid,
    resourceKind: 'chart',
    resourceKey,
    resourceAliases,
    proposed,
    baseline,
  });
  return jsonToolResult({
    data: {
      previewId: entry.previewId,
      status: entry.status,
      contentHash: entry.contentHash,
      resourceKey,
      resourceAliases,
      operation: 'upsert',
      upsertSlug: upsertSlug ?? null,
      expiresAt: entry.expiresAt,
      diff: shallowDiff(current, proposed),
      current,
    },
    context: developerContext(input.scope),
  });
}

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
        'Preview chart-as-code upsert or duplicate ({ sourceChartUuidOrSlug, newSlug, newName? }); issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        chartUuidOrSlug: uuidOrSlugField('Chart UUID or slug').optional(),
        slug: z
          .string()
          .optional()
          .describe('Target slug when creating a new chart (defaults resourceKey)'),
        changes: z
          .union([chartDuplicateChangesSchema, chartUpsertBodySchema])
          .describe('Chart-as-code upsert body, or duplicate proposal matching duplicate_chart'),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      chartUuidOrSlug?: string;
      slug?: string;
      changes: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const getSavedChart: GetSavedChart = async (id) =>
        asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, id));
      const shared = { getSavedChart, sessionId, scope };
      if (isChartDuplicateChanges(args.changes)) {
        return previewDuplicateChart({
          ...shared,
          changes: args.changes,
          chartUuidOrSlug: args.chartUuidOrSlug,
        });
      }
      return previewUpsertChart({
        ...shared,
        changes: args.changes,
        chartUuidOrSlug: args.chartUuidOrSlug,
        slug: args.slug,
      });
    }),
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
        'Preview dashboard create/update or duplicate ({ newName? }); issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug').optional(),
        changes: dashboardChangesBodySchema.describe(
          'Dashboard create/update fields, or duplicate proposal { newName? } matching duplicate_dashboard',
        ),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      dashboardUuidOrSlug?: string;
      changes: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const parsedChanges = parseDashboardChangesBody(args.changes);
      if (!parsedChanges.ok) {
        return codedErrorResult(parsedChanges.code, parsedChanges.message);
      }
      const proposed = parsedChanges.data;
      const isDuplicate = isDashboardDuplicateChanges(args.changes);
      if (isDuplicate && !args.dashboardUuidOrSlug) {
        return codedErrorResult(
          'INVALID_ARGUMENT',
          'dashboardUuidOrSlug is required for duplicate dashboard preview',
        );
      }
      const current = args.dashboardUuidOrSlug
        ? asRecord(await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug))
        : null;
      const baseline = baselineFromResource(current);
      // UUID is canonical for confirm_preview / apply binding; uuid-or-slug remains an apply alias.
      const resourceKey = baseline?.uuid ?? args.dashboardUuidOrSlug ?? 'new';
      const resourceAliases = uniqueResourceKeys(
        resourceKey,
        baseline?.uuid,
        baseline?.slug,
        args.dashboardUuidOrSlug,
      );
      const entry = await addPreviewLedgerEntry({
        sessionId,
        projectUuid: scope.projectUuid,
        resourceKind: 'dashboard',
        resourceKey,
        resourceAliases,
        proposed,
        baseline,
      });
      return jsonToolResult({
        data: {
          previewId: entry.previewId,
          status: entry.status,
          contentHash: entry.contentHash,
          resourceKey,
          resourceAliases,
          operation: isDuplicate ? 'duplicate' : current ? 'update' : 'create',
          expiresAt: entry.expiresAt,
          diff: shallowDiff(current, proposed),
          current,
        },
        context: developerContext(scope),
      });
    }),
  );
}

export function registerPreviewContentMove(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'preview_content_move',
    {
      title: 'Preview content move',
      description:
        'Preview a bulk content move into an existing space (itemUuids + targetSpaceUuid + contentTypes); space create/update is not supported',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        itemUuids: z
          .array(z.string())
          .min(1)
          .describe('Content UUIDs to move (consumed by move_content)'),
        targetSpaceUuid: z
          .string()
          .nullable()
          .describe('Existing target space UUID (null = project root if supported)'),
        contentTypes: z
          .array(z.enum(MOVE_CONTENT_TYPES))
          .min(1)
          .describe(
            'Content type per itemUuids entry; must match move_content exactly or the preview is stale',
          ),
        chartSources: z
          .array(z.enum(MOVE_CHART_SOURCES))
          .optional()
          .describe(
            'Chart source per chart entry in itemUuids; must match move_content exactly or the preview is stale',
          ),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      itemUuids: string[];
      targetSpaceUuid: string | null;
      contentTypes: MoveContentType[];
      chartSources?: MoveChartSource[];
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
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
      const baseline = baselineFromMoveContentManifest(resolved.manifest);
      const entry = await addPreviewLedgerEntry({
        sessionId,
        projectUuid: scope.projectUuid,
        resourceKind: 'content-move',
        resourceKey,
        proposed,
        baseline,
      });
      return jsonToolResult({
        data: {
          previewId: entry.previewId,
          status: entry.status,
          contentHash: entry.contentHash,
          resourceKey,
          expiresAt: entry.expiresAt,
          proposed,
          baseline: resolved.manifest,
        },
        context: developerContext(scope),
      });
    }),
  );
}
