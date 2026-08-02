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
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField, uuidOrSlugField } from '../lib/schema-fields.js';
import { jsonToolResult } from '../shared.js';

import {
  MOVE_CHART_SOURCES,
  MOVE_CONTENT_TYPES,
  developerContext,
  wrapDeveloperHandler,
} from './developer-content-shared.js';
import {
  assertMoveContentLengths,
  buildMoveContentProposal,
  buildMoveContentResourceKey,
  shallowDiff,
} from './developer-helpers.js';

import type { MoveChartSource, MoveContentType } from './developer-helpers.js';
import type { PreviewBaseline } from '../../policy/preview-ledger.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

function baselineFromResource(
  resource: Record<string, unknown> | null,
): PreviewBaseline | undefined {
  if (!resource) {
    return undefined;
  }
  const updatedAt = typeof resource.updatedAt === 'string' ? resource.updatedAt : undefined;
  const uuid = typeof resource.uuid === 'string' ? resource.uuid : undefined;
  const slug = typeof resource.slug === 'string' ? resource.slug : undefined;
  if (updatedAt == null && uuid == null && slug == null) {
    return undefined;
  }
  return { updatedAt, uuid, slug };
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      chartUuidOrSlug?: string;
      slug?: string;
      changes: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const current = args.chartUuidOrSlug
        ? asRecord(await c.v2.charts.getSavedChart(scope.projectUuid, args.chartUuidOrSlug))
        : null;
      const baseline = baselineFromResource(current);
      // Canonical identity is UUID when updating an existing chart (validate_chart binds
      // chartUuid); upsert slug remains an alias so create/update_chart can consume by slug.
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
      const entry = addPreviewLedgerEntry({
        sessionId,
        projectUuid: scope.projectUuid,
        resourceKind: 'chart',
        resourceKey,
        resourceAliases,
        proposed: args.changes,
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
          diff: shallowDiff(current, args.changes),
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
        changes: z.record(z.string(), z.unknown()).describe('Proposed dashboard fields'),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      dashboardUuidOrSlug?: string;
      changes: Record<string, unknown>;
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      const current = args.dashboardUuidOrSlug
        ? asRecord(await c.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuidOrSlug))
        : null;
      const baseline = baselineFromResource(current);
      // UUID is canonical for validate_dashboard; uuid-or-slug remains an apply alias.
      const resourceKey = baseline?.uuid ?? args.dashboardUuidOrSlug ?? 'new';
      const resourceAliases = uniqueResourceKeys(
        resourceKey,
        baseline?.uuid,
        baseline?.slug,
        args.dashboardUuidOrSlug,
      );
      const entry = addPreviewLedgerEntry({
        sessionId,
        projectUuid: scope.projectUuid,
        resourceKind: 'dashboard',
        resourceKey,
        resourceAliases,
        proposed: args.changes,
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
          diff: shallowDiff(current, args.changes),
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
    }>(contextProvider, (_c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();
      assertMoveContentLengths(args.itemUuids, args.contentTypes, args.chartSources);
      const resourceKey = buildMoveContentResourceKey(args.itemUuids);
      const proposed = buildMoveContentProposal({
        itemUuids: args.itemUuids,
        targetSpaceUuid: args.targetSpaceUuid,
        contentTypes: args.contentTypes,
        chartSources: args.chartSources,
      });
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
          proposed,
        },
        context: developerContext(scope),
      });
    }),
  );
}
