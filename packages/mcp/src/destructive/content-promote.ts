/**
 * Dashboard promote operation (ADR-0017) — elicitation-gated cross-project release.
 */

import { WRITE_DESTRUCTIVE } from '@lightdash-tools/common';

import { uuidOrSlugField } from '../tools/lib/schema-fields.js';

import {
  buildPromoteConfirmationMessage,
  isAcceptedPromoteForm,
  PROMOTE_CONFIRM_FORM_SCHEMA,
  type PromoteConfirmFormContent,
} from './confirmation.js';
import { hashPreconditionMaterial } from './precondition.js';
import {
  PROMOTE_GATE_LABELS,
  registerElicitationGatedTool,
  type ScopedDestructiveArgs,
} from './register-destructive-tool.js';
import { CONFIRM_PROMOTE_INPUT_KEY, type DestructiveOperationSpec } from './types.js';

import type { McpContextProvider } from '../server/request-context.js';
import type {
  Dashboard,
  DashboardPromoteDiffResults,
  LightdashClient,
} from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

type PromoteSnapshot = {
  dashboard: {
    uuid?: string;
    slug: string;
    name: string;
    projectUuid: string;
    spaceName: string;
    spaceUuid: string;
    updatedAt: string;
  };
  promoteDiff: DashboardPromoteDiffResults;
};

/** OpenAPI PromotionAction is only create | update | no changes. */
function countActions(rows: { action: string }[] | undefined): Record<string, number> {
  const counts: Record<string, number> = {
    create: 0,
    update: 0,
    'no changes': 0,
  };
  for (const row of rows ?? []) {
    counts[row.action] = (counts[row.action] ?? 0) + 1;
  }
  return counts;
}

function formatActionCounts(label: string, counts: Record<string, number>): string | undefined {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([action, n]) => `${n} ${action}`);
  if (parts.length === 0) {
    return undefined;
  }
  return `${label}: ${parts.join(', ')}`;
}

export function summarizePromotionChanges(diff: DashboardPromoteDiffResults): string[] {
  const lines: string[] = [];
  const chartLine = formatActionCounts('Charts', countActions(diff.charts));
  const dashboardLine = formatActionCounts('Dashboards', countActions(diff.dashboards));
  const spaceLine = formatActionCounts('Spaces', countActions(diff.spaces));
  const sqlLine = formatActionCounts('SQL charts', countActions(diff.sqlCharts));
  const appLine = formatActionCounts('Data apps', countActions(diff.dataApps));
  for (const line of [dashboardLine, chartLine, spaceLine, sqlLine, appLine]) {
    if (line) {
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    lines.push('Promotion diff: no chart/dashboard/space changes reported.');
  }
  return lines;
}

function toDashboardSlice(dashboard: Dashboard): PromoteSnapshot['dashboard'] {
  return {
    uuid: dashboard.uuid,
    slug: dashboard.slug,
    name: dashboard.name,
    projectUuid: dashboard.projectUuid,
    spaceName: dashboard.spaceName,
    spaceUuid: dashboard.spaceUuid,
    updatedAt: dashboard.updatedAt,
  };
}

function buildPromoteSpec(): DestructiveOperationSpec<ScopedDestructiveArgs, PromoteSnapshot> {
  return {
    operationId: 'content-governance.dashboards.promote',
    resourceType: 'dashboard',
    async resolveTarget(args, ctx) {
      const client = ctx.lightdashClient as LightdashClient;
      const [dashboard, promoteDiff] = await Promise.all([
        client.v2.dashboards.getDashboard(args.projectUuid, args.resourceId),
        client.v1.dashboards.getDashboardPromoteDiff(args.resourceId, {
          projectUuid: args.projectUuid,
        }),
      ]);
      return { dashboard: toDashboardSlice(dashboard), promoteDiff };
    },
    summarizeTarget(snapshot) {
      return {
        operation: 'promote',
        resourceType: 'dashboard',
        resourceId: snapshot.dashboard.uuid ?? snapshot.dashboard.slug,
        resourceName: snapshot.dashboard.name,
        projectUuid: snapshot.dashboard.projectUuid,
        location: snapshot.dashboard.spaceName,
        updatedAt: snapshot.dashboard.updatedAt,
        details: summarizePromotionChanges(snapshot.promoteDiff),
        consequences: [
          'Upstream is the project configured under Data Ops (not chosen via tool args).',
          'Nested charts, spaces, and data apps may be created or overwritten upstream.',
        ],
      };
    },
    getPrecondition(snapshot) {
      const resourceId = snapshot.dashboard.uuid ?? snapshot.dashboard.slug;
      return {
        resourceType: 'dashboard',
        resourceId,
        projectUuid: snapshot.dashboard.projectUuid,
        digest: hashPreconditionMaterial({
          name: snapshot.dashboard.name,
          updatedAt: snapshot.dashboard.updatedAt,
          spaceUuid: snapshot.dashboard.spaceUuid,
          promoteDiff: snapshot.promoteDiff,
        }),
      };
    },
    async execute(args, _snapshot, ctx) {
      const promoted = await ctx.lightdashClient.v1.dashboards.promoteDashboard(args.resourceId, {
        projectUuid: args.projectUuid,
      });
      return {
        upstream: {
          uuid: promoted.uuid,
          slug: promoted.slug,
          name: promoted.name,
          projectUuid: promoted.projectUuid,
        },
      };
    },
  };
}

export function registerPromoteDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerElicitationGatedTool<PromoteSnapshot, PromoteConfirmFormContent>(
    server,
    'promote_dashboard',
    contextProvider,
    {
      options: {
        title: 'Promote Lightdash dashboard',
        description:
          'Promote a dashboard (and nested charts) to its configured upstream project after form elicitation. Requires a client that supports form elicitation. Inspect impact first with get_dashboard_promote_diff.',
        annotations: WRITE_DESTRUCTIVE,
        resourceIdField: uuidOrSlugField('Dashboard UUID or slug'),
        resourceIdArgName: 'dashboardUuidOrSlug',
        idempotentHint: false,
      },
      spec: buildPromoteSpec(),
      form: {
        inputKey: CONFIRM_PROMOTE_INPUT_KEY,
        formSchema: PROMOTE_CONFIRM_FORM_SCHEMA,
        buildMessage: buildPromoteConfirmationMessage,
        isAcceptedForm: isAcceptedPromoteForm,
      },
      labels: PROMOTE_GATE_LABELS,
    },
  );
}
