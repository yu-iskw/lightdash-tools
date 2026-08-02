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
  resolveChartPreviewCurrent,
  resolveMoveContentManifest,
  shallowDiff,
} from './developer-helpers.js';
import {
  chartUpsertBodySchema,
  dashboardChangesBodySchema,
  parseChartUpsertBody,
  parseDashboardChangesBody,
} from './schemas/index.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

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
        changes: chartUpsertBodySchema.describe('Proposed chart-as-code payload'),
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
      const parsedChanges = parseChartUpsertBody(args.changes);
      if (!parsedChanges.ok) {
        return codedErrorResult(parsedChanges.code, parsedChanges.message);
      }
      const proposed = parsedChanges.data;
      const resolved = await resolveChartPreviewCurrent({
        chartUuidOrSlug: args.chartUuidOrSlug,
        slug: args.slug,
        getSavedChart: async (id) =>
          asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, id)),
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
        args.slug ?? (typeof current?.slug === 'string' ? current.slug : undefined) ?? undefined;
      const resourceKey =
        baseline?.uuid ?? upsertSlug ?? args.chartUuidOrSlug ?? args.slug ?? 'new';
      const resourceAliases = uniqueResourceKeys(
        resourceKey,
        baseline?.uuid,
        baseline?.slug,
        upsertSlug,
        args.chartUuidOrSlug,
        args.slug,
      );
      const entry = await addPreviewLedgerEntry({
        sessionId,
        projectUuid: scope.projectUuid,
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
          upsertSlug: upsertSlug ?? null,
          expiresAt: entry.expiresAt,
          diff: shallowDiff(current, proposed),
          current,
        },
        context: developerContext(scope),
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
        'Preview unsaved dashboard edits by diffing against the current saved definition; issues a single-use previewId',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        dashboardUuidOrSlug: uuidOrSlugField('Dashboard UUID or slug').optional(),
        changes: dashboardChangesBodySchema.describe('Proposed dashboard fields'),
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
