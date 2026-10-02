/**
 * Content-developer rename tools (ADR-0018).
 *
 * list_rename_fields reads the dropdown. preview_rename stores a RenameInstruction.
 * Chart and dashboard scopes do not call POST /rename/preview. Project scope does,
 * and stores the uuid lists on the baseline. Apply claims that preview, posts the
 * matching rename endpoint, then marks the preview applied.
 */

import { WRITE_NONDESTRUCTIVE } from '@lightdash-tools/common';
import { z } from 'zod';

import { getMcpClientSessionId } from '../../governance/mcp-client-session.js';
import { resolveProjectScope } from '../../governance/project-scope.js';
import {
  DISCOVERY_SAFETY,
  PREVIEW_SAFETY,
  WRITE_SAFETY,
  registerContentDeveloperTool,
} from '../../policy/content-developer.js';
import {
  addPreviewLedgerEntry,
  getOwnedPreview,
  withClaimedPreviewApply,
} from '../../policy/preview-ledger.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { jsonToolResult } from '../shared.js';

import { developerContext, wrapDeveloperHandler } from './developer-content-shared.js';
import { baselineFromResource } from './developer-helpers.js';
import {
  RenameRejectedError,
  assertApplyIsNotDryRun,
  assertListedFieldId,
  assertRenameNamesDiffer,
  parseRenameInstruction,
  projectRenameBody,
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

type RenameFieldsResult = components['schemas']['ApiRenameFieldsResponse']['results'];
type RenamePreviewResult = components['schemas']['ApiRenameResponse']['results'];
type RenameChartResult = components['schemas']['ApiRenameChartResponse']['results'];
type RenameDashboardResult = components['schemas']['ApiRenameDashboardResponse']['results'];
type RenameJobResult = components['schemas']['ApiJobScheduledResponse']['results'];

export type RenameApi = {
  listChartFields: (projectUuid: string, chartUuid: string) => Promise<RenameFieldsResult>;
  listDashboardFields: (
    projectUuid: string,
    dashboardUuid: string,
    table?: string,
  ) => Promise<RenameFieldsResult>;
  previewRename: (
    projectUuid: string,
    body: components['schemas']['ApiRenameBody'],
  ) => Promise<RenamePreviewResult>;
  renameChart: (
    projectUuid: string,
    chartUuid: string,
    body: components['schemas']['ApiRenameChartBody'],
  ) => Promise<RenameChartResult>;
  renameDashboardFilter: (
    projectUuid: string,
    dashboardUuid: string,
    body: components['schemas']['ApiRenameDashboardBody'],
  ) => Promise<RenameDashboardResult>;
  renameResources: (
    projectUuid: string,
    body: components['schemas']['ApiRenameBody'],
  ) => Promise<RenameJobResult>;
  getSavedChart: (projectUuid: string, chartUuid: string) => Promise<Record<string, unknown>>;
  getDashboard: (projectUuid: string, dashboardUuid: string) => Promise<Record<string, unknown>>;
};

const renameTypeSchema = z.enum(['field', 'model']);
const renameNameSchema = z.string().min(1);

const previewIdField = () => z.string().describe('Single-use previewId from preview_rename');

function storedName(value: string | undefined): string | null {
  return value == null || value === '' ? null : value;
}

function sameOptionalName(stored: string | null, given: string | undefined): boolean {
  return storedName(stored ?? undefined) === storedName(given);
}

function renameApiFromClient(client: LightdashClient): RenameApi {
  return {
    listChartFields: (projectUuid, chartUuid) =>
      client.v1.rename.listChartFields(projectUuid, chartUuid),
    listDashboardFields: (projectUuid, dashboardUuid, table) =>
      client.v1.rename.listDashboardFields(projectUuid, dashboardUuid, table),
    previewRename: (projectUuid, body) => client.v1.rename.previewRename(projectUuid, body),
    renameChart: (projectUuid, chartUuid, body) =>
      client.v1.rename.renameChart(projectUuid, chartUuid, body),
    renameDashboardFilter: (projectUuid, dashboardUuid, body) =>
      client.v1.rename.renameDashboardFilter(projectUuid, dashboardUuid, body),
    renameResources: (projectUuid, body) => client.v1.rename.renameResources(projectUuid, body),
    getSavedChart: async (projectUuid, chartUuid) =>
      asRecord(await client.v2.charts.getSavedChart(projectUuid, chartUuid)),
    getDashboard: async (projectUuid, dashboardUuid) =>
      asRecord(await client.v2.dashboards.getDashboard(projectUuid, dashboardUuid)),
  };
}

function tableNameOf(resource: Record<string, unknown>): string | undefined {
  const tableName = resource.tableName;
  return typeof tableName === 'string' && tableName.length > 0 ? tableName : undefined;
}

export async function listRenameFields(
  api: RenameApi,
  input: {
    projectUuid: string;
    target: 'chart' | 'dashboard';
    chartUuid?: string;
    dashboardUuid?: string;
    table?: string;
  },
): Promise<RenameFieldsResult> {
  if (input.target === 'chart') {
    if (input.chartUuid == null || input.chartUuid === '') {
      throw new RenameRejectedError(
        'RENAME_TARGET',
        'list_rename_fields for a chart needs chartUuid',
      );
    }
    return api.listChartFields(input.projectUuid, input.chartUuid);
  }
  if (input.dashboardUuid == null || input.dashboardUuid === '') {
    throw new RenameRejectedError(
      'RENAME_TARGET',
      'list_rename_fields for a dashboard needs dashboardUuid',
    );
  }
  return api.listDashboardFields(input.projectUuid, input.dashboardUuid, input.table);
}

type RenamePreviewResultBody = {
  previewId: string;
  resourceKind: 'rename';
  resourceKey: string;
  status: 'draft';
  fields?: RenameFieldsResult['fields'];
  impact?: ReturnType<typeof renameImpactFromChanges>;
};

function draftRename(entry: { previewId: string; resourceKey: string }): RenamePreviewResultBody {
  return {
    previewId: entry.previewId,
    resourceKind: 'rename',
    resourceKey: entry.resourceKey,
    status: 'draft',
  };
}

async function listedFields(
  type: RenameKind,
  to: string,
  load: () => Promise<RenameFieldsResult>,
): Promise<RenameFieldsResult['fields'] | undefined> {
  if (type !== 'field') {
    return undefined;
  }
  const fields = await load();
  assertListedFieldId(fields.fields, to);
  return fields.fields;
}

async function issueChartPreview(
  api: RenameApi,
  input: {
    sessionId: string;
    projectUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    chartUuid: string;
  },
): Promise<RenamePreviewResultBody> {
  const chart = await api.getSavedChart(input.projectUuid, input.chartUuid);
  const fields = await listedFields(input.type, input.to, () =>
    api.listChartFields(input.projectUuid, input.chartUuid),
  );
  const proposed: ChartRenameInstruction = {
    scope: 'chart',
    chartUuid: input.chartUuid,
    type: input.type,
    from: input.from,
    to: input.to,
    tableName: storedName(tableNameOf(chart)),
  };
  const entry = await addPreviewLedgerEntry({
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    resourceKind: 'rename',
    resourceKey: input.chartUuid,
    proposed,
    baseline: baselineFromResource(chart),
  });
  return { ...draftRename(entry), ...(fields == null ? {} : { fields }) };
}

async function issueDashboardPreview(
  api: RenameApi,
  input: {
    sessionId: string;
    projectUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    dashboardUuid: string;
    table?: string;
  },
): Promise<RenamePreviewResultBody> {
  const dashboard = await api.getDashboard(input.projectUuid, input.dashboardUuid);
  const fields = await listedFields(input.type, input.to, () =>
    api.listDashboardFields(input.projectUuid, input.dashboardUuid, input.table),
  );
  const proposed: DashboardFilterRenameInstruction = {
    scope: 'dashboard-filter',
    dashboardUuid: input.dashboardUuid,
    type: input.type,
    from: input.from,
    to: input.to,
  };
  const entry = await addPreviewLedgerEntry({
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    resourceKind: 'rename',
    resourceKey: input.dashboardUuid,
    proposed,
    baseline: baselineFromResource(dashboard),
  });
  return { ...draftRename(entry), ...(fields == null ? {} : { fields }) };
}

async function issueProjectPreview(
  api: RenameApi,
  input: {
    sessionId: string;
    projectUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    model?: string;
  },
): Promise<RenamePreviewResultBody> {
  const model = storedName(input.model);
  if (input.type === 'field' && model == null) {
    throw new RenameRejectedError(
      'RENAME_TARGET',
      'A project field rename needs model set to the explore name, plus full field ids',
    );
  }
  const proposed: ProjectRenameInstruction = {
    scope: 'project',
    type: input.type,
    from: input.from,
    to: input.to,
    model,
  };
  const impact = await api.previewRename(input.projectUuid, projectRenameBody(proposed, true));
  const renameImpact = renameImpactFromChanges(impact);
  const entry = await addPreviewLedgerEntry({
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    resourceKind: 'rename',
    resourceKey: projectRenameResourceKey(proposed),
    proposed,
    baseline: { renameImpact },
  });
  return { ...draftRename(entry), impact: renameImpact };
}

export async function issueRenamePreview(
  api: RenameApi,
  input: {
    sessionId: string;
    projectUuid: string;
    scope: 'chart' | 'dashboard-filter' | 'project';
    type: RenameKind;
    from: string;
    to: string;
    chartUuid?: string;
    dashboardUuid?: string;
    model?: string;
    table?: string;
  },
): Promise<RenamePreviewResultBody> {
  assertRenameNamesDiffer(input.from, input.to);
  if (input.scope === 'chart') {
    if (input.chartUuid == null || input.chartUuid === '') {
      throw new RenameRejectedError('RENAME_TARGET', 'preview_rename for a chart needs chartUuid');
    }
    return issueChartPreview(api, { ...input, chartUuid: input.chartUuid });
  }
  if (input.scope === 'dashboard-filter') {
    if (input.dashboardUuid == null || input.dashboardUuid === '') {
      throw new RenameRejectedError(
        'RENAME_TARGET',
        'preview_rename for a dashboard filter needs dashboardUuid',
      );
    }
    return issueDashboardPreview(api, { ...input, dashboardUuid: input.dashboardUuid });
  }
  return issueProjectPreview(api, input);
}

function instructionForScope<S extends RenameInstruction['scope']>(
  instruction: RenameInstruction,
  scope: S,
): Extract<RenameInstruction, { scope: S }> | undefined {
  if (instruction.scope !== scope) {
    return undefined;
  }
  return instruction as Extract<RenameInstruction, { scope: S }>;
}

async function claimAndApply<S extends RenameInstruction['scope'], T>(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  dryRun?: boolean;
  expectedScope: S;
  matches: (instruction: Extract<RenameInstruction, { scope: S }>) => boolean;
  currentBaseline: (
    instruction: Extract<RenameInstruction, { scope: S }>,
  ) => Promise<PreviewBaseline | undefined>;
  mutate: (instruction: Extract<RenameInstruction, { scope: S }>) => Promise<T>;
}): Promise<T> {
  assertApplyIsNotDryRun(input.dryRun);
  const entry = await getOwnedPreview({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
  });
  const instruction = instructionForScope(
    parseRenameInstruction(entry.proposed),
    input.expectedScope,
  );
  if (instruction == null || !input.matches(instruction)) {
    throw new RenameRejectedError(
      'RENAME_SCOPE',
      `This apply tool only accepts a ${input.expectedScope} instruction`,
    );
  }
  const currentBaseline = await input.currentBaseline(instruction);
  return withClaimedPreviewApply(
    {
      previewId: input.previewId,
      sessionId: input.sessionId,
      projectUuid: input.projectUuid,
      resourceKind: 'rename',
      resourceKey: entry.resourceKey,
      proposed: entry.proposed,
      currentBaseline,
    },
    async () => input.mutate(instruction),
  );
}

const VALIDATE_CHART_NEXT = 'Run validate_chart on the saved chart.';
const VALIDATE_DASHBOARD_NEXT = 'Run validate_dashboard on the saved dashboard.';
const PROJECT_NEXT =
  'rename_project returns jobId and does not poll. When the job finishes, run validate_chart or list validation results. If charts or dashboards as code live in git, run lightdash download and commit before the next lightdash deploy.';

export async function applyChartRename(
  api: RenameApi,
  input: {
    previewId: string;
    sessionId: string;
    projectUuid: string;
    chartUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    dryRun?: boolean;
  },
): Promise<{ applied: true; jobId?: string; next: string }> {
  const result = await claimAndApply({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    dryRun: input.dryRun,
    expectedScope: 'chart',
    matches: (instruction) =>
      instruction.chartUuid === input.chartUuid &&
      instruction.type === input.type &&
      instruction.from === input.from &&
      instruction.to === input.to,
    currentBaseline: async () =>
      baselineFromResource(await api.getSavedChart(input.projectUuid, input.chartUuid)),
    mutate: (instruction) =>
      api.renameChart(input.projectUuid, instruction.chartUuid, {
        type: instruction.type,
        from: instruction.from,
        to: instruction.to,
      }),
  });
  return {
    applied: true,
    ...(result.jobId == null ? {} : { jobId: result.jobId }),
    next: VALIDATE_CHART_NEXT,
  };
}

export async function applyDashboardFilterRename(
  api: RenameApi,
  input: {
    previewId: string;
    sessionId: string;
    projectUuid: string;
    dashboardUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    dryRun?: boolean;
  },
): Promise<{ applied: true; jobId?: string; next: string }> {
  const result = await claimAndApply({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    dryRun: input.dryRun,
    expectedScope: 'dashboard-filter',
    matches: (instruction) =>
      instruction.dashboardUuid === input.dashboardUuid &&
      instruction.type === input.type &&
      instruction.from === input.from &&
      instruction.to === input.to,
    currentBaseline: async () =>
      baselineFromResource(await api.getDashboard(input.projectUuid, input.dashboardUuid)),
    mutate: (instruction) =>
      api.renameDashboardFilter(input.projectUuid, instruction.dashboardUuid, {
        type: instruction.type,
        from: instruction.from,
        to: instruction.to,
      }),
  });
  return {
    applied: true,
    ...(result.jobId == null ? {} : { jobId: result.jobId }),
    next: VALIDATE_DASHBOARD_NEXT,
  };
}

export async function applyProjectRename(
  api: RenameApi,
  input: {
    previewId: string;
    sessionId: string;
    projectUuid: string;
    type: RenameKind;
    from: string;
    to: string;
    model?: string;
    dryRun?: boolean;
  },
): Promise<{ applied: true; jobId: string; next: string }> {
  const result = await claimAndApply({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    dryRun: input.dryRun,
    expectedScope: 'project',
    matches: (instruction) =>
      instruction.type === input.type &&
      instruction.from === input.from &&
      instruction.to === input.to &&
      sameOptionalName(instruction.model, input.model),
    currentBaseline: async (instruction) => {
      const fresh = await api.previewRename(
        input.projectUuid,
        projectRenameBody(instruction, true),
      );
      return { renameImpact: renameImpactFromChanges(fresh) };
    },
    mutate: (instruction) => api.renameResources(input.projectUuid, projectRenameBody(instruction)),
  });
  return { applied: true, jobId: result.jobId, next: PROJECT_NEXT };
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
    }>(contextProvider, (client) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const fields = await listRenameFields(renameApiFromClient(client), {
        projectUuid: scope.projectUuid,
        target: args.target,
        chartUuid: args.chartUuid,
        dashboardUuid: args.dashboardUuid,
        table: args.table,
      });
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
        'Store a rename instruction and return previewId. Chart and dashboard scopes do not call the project rename preview. Project scope records affected resource uuids. Confirm with resourceKind rename before apply. Does not write a chart version.',
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
    wrapDeveloperHandler<{
      projectUuid?: string;
      scope: 'chart' | 'dashboard-filter' | 'project';
      type: RenameKind;
      from: string;
      to: string;
      chartUuid?: string;
      dashboardUuid?: string;
      model?: string;
      table?: string;
    }>(contextProvider, (client) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const preview = await issueRenamePreview(renameApiFromClient(client), {
        sessionId: getMcpClientSessionId(),
        projectUuid: scope.projectUuid,
        scope: args.scope,
        type: args.type,
        from: args.from,
        to: args.to,
        chartUuid: args.chartUuid,
        dashboardUuid: args.dashboardUuid,
        model: args.model,
        table: args.table,
      });
      return jsonToolResult({ data: preview, context: developerContext(scope) });
    }),
  );
}

function registerRenameChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentDeveloperTool(
    server,
    'rename_chart',
    {
      title: 'Rename chart field or model',
      description:
        'Apply a confirmed chart rename instruction. Posts once to the chart rename endpoint and does not upsert chart-as-code. Then run validate_chart.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        chartUuid: z.string(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      chartUuid: string;
      type: RenameKind;
      from: string;
      to: string;
      dryRun?: boolean;
    }>(contextProvider, (client) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const applied = await applyChartRename(renameApiFromClient(client), {
        previewId: args.previewId,
        sessionId: getMcpClientSessionId(),
        projectUuid: scope.projectUuid,
        chartUuid: args.chartUuid,
        type: args.type,
        from: args.from,
        to: args.to,
        dryRun: args.dryRun,
      });
      return jsonToolResult({ data: applied, context: developerContext(scope) });
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
      description:
        'Apply a confirmed dashboard-filter rename instruction. Then run validate_dashboard.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        dashboardUuid: z.string(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      dashboardUuid: string;
      type: RenameKind;
      from: string;
      to: string;
      dryRun?: boolean;
    }>(contextProvider, (client) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const applied = await applyDashboardFilterRename(renameApiFromClient(client), {
        previewId: args.previewId,
        sessionId: getMcpClientSessionId(),
        projectUuid: scope.projectUuid,
        dashboardUuid: args.dashboardUuid,
        type: args.type,
        from: args.from,
        to: args.to,
        dryRun: args.dryRun,
      });
      return jsonToolResult({ data: applied, context: developerContext(scope) });
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
        'Apply a confirmed project rename. Re-checks the preview uuid lists, posts the project rename, and returns jobId without polling. If content as code lives in git, run lightdash download before the next deploy.',
      safety: WRITE_SAFETY,
      annotations: WRITE_NONDESTRUCTIVE,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        previewId: previewIdField(),
        type: renameTypeSchema,
        from: renameNameSchema,
        to: renameNameSchema,
        model: z.string().min(1).optional().describe('Explore name. Required when type is field'),
        dryRun: z.boolean().optional(),
      },
    },
    wrapDeveloperHandler<{
      projectUuid?: string;
      previewId: string;
      type: RenameKind;
      from: string;
      to: string;
      model?: string;
      dryRun?: boolean;
    }>(contextProvider, (client) => async (args) => {
      const scope = resolveProjectScope({ projectUuid: args.projectUuid });
      const applied = await applyProjectRename(renameApiFromClient(client), {
        previewId: args.previewId,
        sessionId: getMcpClientSessionId(),
        projectUuid: scope.projectUuid,
        type: args.type,
        from: args.from,
        to: args.to,
        model: args.model,
        dryRun: args.dryRun,
      });
      return jsonToolResult({ data: applied, context: developerContext(scope) });
    }),
  );
}

export {
  RenameRejectedError,
  registerListRenameFields,
  registerPreviewRename,
  registerRenameChart,
  registerRenameDashboardFilter,
  registerRenameProject,
};
