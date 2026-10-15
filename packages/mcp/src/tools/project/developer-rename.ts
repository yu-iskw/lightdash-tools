/**
 * Content-developer rename tools (ADR-0036).
 *
 * preview_rename mints a previewToken (ADR-0019) over a RenameInstruction. Chart and
 * dashboard scopes bind the saved resource baseline and do not call POST /rename/preview.
 * Project scope calls it and binds the impacted uuid lists. Apply tools rebuild the
 * instruction from their own arguments, so a token unlocks only the rename it previewed.
 */

import { WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';
import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  DISCOVERY_SAFETY,
  PREVIEW_SAFETY,
  WRITE_SAFETY,
  registerContentDeveloperTool,
} from '../../policy/content-developer.js';
import { mintDraftPreviewToken, withValidatedPreviewApply } from '../../policy/preview-ledger.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult } from '../shared.js';
import { defineTool } from '../types.js';

import { developerContext, wrapDeveloperHandler } from './developer-content-shared.js';
import { baselineFromResource } from './developer-helpers.js';
import {
  RenameRejectedError,
  assertApplyIsNotDryRun,
  assertListedFieldId,
  assertRenameNamesDiffer,
  assertRenameToken,
  projectFieldShortName,
  projectRenameBody,
  projectRenameJobBody,
  projectRenameResourceKey,
  renameImpactFromChanges,
} from './rename-instruction.js';

import type {
  ChartRenameInstruction,
  DashboardFilterRenameInstruction,
  ProjectRenameInstruction,
  RenameInstruction,
  RenameKind,
} from './rename-instruction.js';
import type { PreviewBaseline } from '../../policy/preview-ledger.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { components } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

type RenameFields = components['schemas']['ApiRenameFieldsResponse']['results']['fields'];

const renameTypeSchema = z.enum(['field', 'model']);
const renameNameSchema = z.string().min(1);

const previewTokenField = () =>
  z.string().describe('Validated previewToken from preview_rename then confirm_preview');

const VALIDATE_CHART_NEXT = 'Run validate_chart on the saved chart.';
const VALIDATE_DASHBOARD_NEXT = 'Run validate_dashboard on the saved dashboard.';
const PROJECT_NEXT =
  'rename_project returns jobId and does not poll. When the job finishes, run validate_chart or validate_dashboard on the previewed uuids. If charts or dashboards as code live in git, run lightdash download and commit before the next lightdash upload.';

type PreviewRenameArgs = {
  projectUuid?: string;
  scope: RenameInstruction['scope'];
  type: RenameKind;
  from: string;
  to: string;
  chartUuid?: string;
  dashboardUuid?: string;
  model?: string;
  table?: string;
};

type RenameDraft = {
  proposed: RenameInstruction;
  resourceKey: string;
  baseline: PreviewBaseline | undefined;
  fields?: RenameFields;
};

function requireTarget(value: string | undefined, message: string): string {
  if (value == null || value === '') {
    throw new RenameRejectedError('RENAME_TARGET', message);
  }
  return value;
}

async function listedFields(
  type: RenameKind,
  to: string,
  load: () => Promise<{ fields: RenameFields }>,
): Promise<RenameFields | undefined> {
  if (type !== 'field') {
    return undefined;
  }
  const { fields } = await load();
  assertListedFieldId(fields, to);
  return fields;
}

async function draftChartRename(
  client: LightdashClient,
  projectUuid: string,
  args: PreviewRenameArgs,
): Promise<RenameDraft> {
  const chartUuid = requireTarget(args.chartUuid, 'preview_rename for a chart needs chartUuid');
  const chart = asRecord(await client.v2.charts.getSavedChart(projectUuid, chartUuid));
  const fields = await listedFields(args.type, args.to, () =>
    client.v1.rename.listChartFields(projectUuid, chartUuid),
  );
  const proposed: ChartRenameInstruction = {
    scope: 'chart',
    chartUuid,
    type: args.type,
    from: args.from,
    to: args.to,
  };
  return { proposed, resourceKey: chartUuid, baseline: baselineFromResource(chart), fields };
}

async function draftDashboardFilterRename(
  client: LightdashClient,
  projectUuid: string,
  args: PreviewRenameArgs,
): Promise<RenameDraft> {
  const dashboardUuid = requireTarget(
    args.dashboardUuid,
    'preview_rename for a dashboard filter needs dashboardUuid',
  );
  const dashboard = asRecord(await client.v2.dashboards.getDashboard(projectUuid, dashboardUuid));
  const fields = await listedFields(args.type, args.to, () =>
    client.v1.rename.listDashboardFields(projectUuid, dashboardUuid, args.table),
  );
  const proposed: DashboardFilterRenameInstruction = {
    scope: 'dashboard-filter',
    dashboardUuid,
    type: args.type,
    from: args.from,
    to: args.to,
  };
  return {
    proposed,
    resourceKey: dashboardUuid,
    baseline: baselineFromResource(dashboard),
    fields,
  };
}

async function draftProjectRename(
  client: LightdashClient,
  projectUuid: string,
  args: PreviewRenameArgs,
): Promise<RenameDraft> {
  if (args.type === 'field' && args.model == null) {
    throw new RenameRejectedError(
      'RENAME_TARGET',
      'A project field rename needs model set to the explore name, plus full field ids',
    );
  }
  if (args.model != null) {
    assertRenameToken(args.model, 'model');
  }
  if (args.type === 'field' && args.model != null) {
    projectFieldShortName(args.model, args.from);
    projectFieldShortName(args.model, args.to);
  }
  const proposed: ProjectRenameInstruction = {
    scope: 'project',
    type: args.type,
    from: args.from,
    to: args.to,
    model: args.model ?? null,
  };
  const impact = renameImpactFromChanges(
    await client.v1.rename.previewRename(projectUuid, projectRenameBody(proposed, true)),
  );
  return {
    proposed,
    resourceKey: projectRenameResourceKey(proposed),
    baseline: { renameImpact: impact },
  };
}

function draftRename(
  client: LightdashClient,
  projectUuid: string,
  args: PreviewRenameArgs,
): Promise<RenameDraft> {
  assertRenameNamesDiffer(args.from, args.to);
  switch (args.scope) {
    case 'chart':
      return draftChartRename(client, projectUuid, args);
    case 'dashboard-filter':
      return draftDashboardFilterRename(client, projectUuid, args);
    case 'project':
      return draftProjectRename(client, projectUuid, args);
    default: {
      const unhandled: never = args.scope;
      throw new RenameRejectedError('RENAME_TARGET', `Unknown rename scope '${String(unhandled)}'`);
    }
  }
}

function applied(jobId: string | undefined, next: string) {
  return { applied: true as const, ...(jobId == null ? {} : { jobId }), next };
}

function registerListRenameFields(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'list_rename_fields',
    {
      title: 'List rename fields',
      description:
        'List real field ids that can replace a missing chart field or dashboard filter target. Requires project update permission.',
      safety: DISCOVERY_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        target: z.enum(['chart', 'dashboard']),
        chartUuid: z.string().optional(),
        dashboardUuid: z.string().optional(),
        table: z.string().optional().describe('Dashboard field list table filter'),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      target: 'chart' | 'dashboard';
      chartUuid?: string;
      dashboardUuid?: string;
      table?: string;
    }>(contextProvider, ({ client }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const fields =
        args.target === 'chart'
          ? await client.v1.rename.listChartFields(
              scope.projectUuid,
              requireTarget(args.chartUuid, 'list_rename_fields for a chart needs chartUuid'),
            )
          : await client.v1.rename.listDashboardFields(
              scope.projectUuid,
              requireTarget(
                args.dashboardUuid,
                'list_rename_fields for a dashboard needs dashboardUuid',
              ),
              args.table,
            );
      return jsonToolResult({ data: fields, context: developerContext(scope) });
    }),
  );
}

function registerPreviewRename(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'preview_rename',
    {
      title: 'Preview rename',
      description:
        'Mint a previewToken for a rename instruction. Chart and dashboard scopes do not call the project rename preview. Project scope records affected resource uuids. Confirm with resourceKind rename before apply. Does not write a chart version.',
      safety: PREVIEW_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        scope: z.enum(['chart', 'dashboard-filter', 'project']),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        chartUuid: z.string().optional(),
        dashboardUuid: z.string().optional(),
        model: z
          .string()
          .min(1)
          .optional()
          .describe('Explore name. Required when type is field and scope is project'),
        table: z.string().optional().describe('Dashboard field list table filter'),
      },
    },
    wrapDeveloperHandler<PreviewRenameArgs>(
      contextProvider,
      ({ client, subject, serverContext }) =>
        async (args) => {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const draft = await draftRename(client, scope.projectUuid, args);
          const entry = await mintDraftPreviewToken({
            subject,
            serverContext,
            projectUuid: scope.projectUuid,
            resourceKind: 'rename',
            resourceKey: draft.resourceKey,
            proposed: draft.proposed,
            baseline: draft.baseline,
          });
          return jsonToolResult({
            data: {
              previewToken: entry.previewToken,
              previewId: entry.claims.previewId,
              resourceKind: entry.claims.resourceKind,
              resourceKey: draft.resourceKey,
              status: entry.claims.status,
              contentHash: entry.claims.contentHash,
              expiresAt: entry.claims.expiresAt,
              ...(draft.fields == null ? {} : { fields: draft.fields }),
              ...(draft.baseline?.renameImpact == null
                ? {}
                : { impact: draft.baseline.renameImpact }),
            },
            context: developerContext(scope),
          });
        },
    ),
  );
}

function registerRenameChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'rename_chart',
    {
      title: 'Rename chart field or model',
      description:
        'Apply a confirmed chart rename. Posts once to the chart rename endpoint and does not upsert chart-as-code. Then run validate_chart.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewToken: previewTokenField(),
        chartUuid: z.string(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewToken: string;
      chartUuid: string;
      type: RenameKind;
      from: string;
      to: string;
      dryRun?: boolean;
    }>(contextProvider, ({ client, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      assertApplyIsNotDryRun(args.dryRun);
      const chart = asRecord(
        await client.v2.charts.getSavedChart(scope.projectUuid, args.chartUuid),
      );
      const proposed: ChartRenameInstruction = {
        scope: 'chart',
        chartUuid: args.chartUuid,
        type: args.type,
        from: args.from,
        to: args.to,
      };
      const result = await withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'rename',
          resourceKey: args.chartUuid,
          proposed,
          currentBaseline: baselineFromResource(chart),
        },
        () =>
          client.v1.rename.renameChart(scope.projectUuid, args.chartUuid, {
            type: proposed.type,
            from: proposed.from,
            to: proposed.to,
          }),
      );
      return jsonToolResult({
        data: applied(result.jobId, VALIDATE_CHART_NEXT),
        context: developerContext(scope),
      });
    }),
  );
}

function registerRenameDashboardFilter(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentDeveloperTool(
    server,
    'rename_dashboard_filter',
    {
      title: 'Rename dashboard filter',
      description: 'Apply a confirmed dashboard-filter rename. Then run validate_dashboard.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewToken: previewTokenField(),
        dashboardUuid: z.string(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewToken: string;
      dashboardUuid: string;
      type: RenameKind;
      from: string;
      to: string;
      dryRun?: boolean;
    }>(contextProvider, ({ client, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      assertApplyIsNotDryRun(args.dryRun);
      const dashboard = asRecord(
        await client.v2.dashboards.getDashboard(scope.projectUuid, args.dashboardUuid),
      );
      const proposed: DashboardFilterRenameInstruction = {
        scope: 'dashboard-filter',
        dashboardUuid: args.dashboardUuid,
        type: args.type,
        from: args.from,
        to: args.to,
      };
      const result = await withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'rename',
          resourceKey: args.dashboardUuid,
          proposed,
          currentBaseline: baselineFromResource(dashboard),
        },
        () =>
          client.v1.rename.renameDashboardFilter(scope.projectUuid, args.dashboardUuid, {
            type: proposed.type,
            from: proposed.from,
            to: proposed.to,
          }),
      );
      return jsonToolResult({
        data: applied(result.jobId, VALIDATE_DASHBOARD_NEXT),
        context: developerContext(scope),
      });
    }),
  );
}

function registerRenameProject(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'rename_project',
    {
      title: 'Rename across the project',
      description:
        'Apply a confirmed project rename. Re-checks the preview uuid lists, posts the project rename, and returns jobId without polling. If content as code lives in git, run lightdash download before the next lightdash upload.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewToken: previewTokenField(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        model: z.string().min(1).optional().describe('Explore name. Required when type is field'),
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewToken: string;
      type: RenameKind;
      from: string;
      to: string;
      model?: string;
      dryRun?: boolean;
    }>(contextProvider, ({ client, subject, serverContext }) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      assertApplyIsNotDryRun(args.dryRun);
      const proposed: ProjectRenameInstruction = {
        scope: 'project',
        type: args.type,
        from: args.from,
        to: args.to,
        model: args.model ?? null,
      };
      const fresh = renameImpactFromChanges(
        await client.v1.rename.previewRename(scope.projectUuid, projectRenameBody(proposed, true)),
      );
      const { jobId } = await withValidatedPreviewApply(
        {
          previewToken: args.previewToken,
          subject,
          serverContext,
          projectUuid: scope.projectUuid,
          resourceKind: 'rename',
          resourceKey: projectRenameResourceKey(proposed),
          proposed,
          currentBaseline: { renameImpact: fresh },
        },
        () => client.v1.rename.renameResources(scope.projectUuid, projectRenameJobBody(proposed)),
      );
      return jsonToolResult({
        data: applied(jobId, PROJECT_NEXT),
        context: developerContext(scope),
      });
    }),
  );
}

export const listRenameFieldsTool = defineTool('list_rename_fields', registerListRenameFields);
export const previewRenameTool = defineTool('preview_rename', registerPreviewRename);
export const renameChartTool = defineTool('rename_chart', registerRenameChart);
export const renameDashboardFilterTool = defineTool(
  'rename_dashboard_filter',
  registerRenameDashboardFilter,
);
export const renameProjectTool = defineTool('rename_project', registerRenameProject);
