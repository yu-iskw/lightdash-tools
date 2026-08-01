/**
 * Content-developer preview_* tools (ADR-0014).
 *
 * Issues a single-use previewId via the session-scoped preview ledger. `preview_space_changes`
 * also serves as the preview for `move_content` (pass `itemUuids` + `targetSpaceUuid`).
 */

import { z } from 'zod';

import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import { PREVIEW_SAFETY, registerContentDeveloperTool } from '../../policy/content-developer.js';
import { addPreviewLedgerEntry } from '../../policy/preview-ledger.js';
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
  shallowDiff,
} from './developer-helpers.js';

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
    }),
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
        contentTypes: z
          .array(z.enum(MOVE_CONTENT_TYPES))
          .optional()
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
      spaceUuid?: string;
      changes?: Record<string, unknown>;
      itemUuids?: string[];
      targetSpaceUuid?: string | null;
      contentTypes?: MoveContentType[];
      chartSources?: MoveChartSource[];
    }>(contextProvider, (c) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const sessionId = getMcpClientSessionId();

      if (args.itemUuids && args.itemUuids.length > 0) {
        assertMoveContentLengths(args.itemUuids, args.contentTypes, args.chartSources);
        const resourceKey = [...args.itemUuids].sort().join(',');
        const proposed = buildMoveContentProposal({
          itemUuids: args.itemUuids,
          targetSpaceUuid: args.targetSpaceUuid ?? null,
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
    }),
  );
}
