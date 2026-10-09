/**
 * Rename tools over a real MCP client on the content-developer profile (ADR-0036).
 * The Lightdash client is a hand-written fake that records rename reads and writes.
 */

import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetPreviewLedgerForTests } from '../../policy/preview-ledger.js';
import { getProfile } from '../../profiles/index.js';
import { createLightdashMcpServer } from '../../server/server.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const CHART = '22222222-2222-4222-8222-222222222222';
const OTHER_CHART = '44444444-4444-4444-8444-444444444444';
const DASHBOARD = '33333333-3333-4333-8333-333333333333';
const UPDATED_AT = '2026-10-01T00:00:00.000Z';

type Upstream = {
  chartUpdatedAt: string;
  impactChartUuids: string[];
  fieldLists: string[];
  previews: unknown[];
  writes: Array<{ endpoint: string; body: unknown }>;
};

type ToolCall = {
  isError: boolean;
  data: Record<string, unknown>;
  error?: { code: string; message: string };
};

const FIELDS = { orders: ['orders_status'], customers: ['customers_region'] };

function createUpstream(): Upstream {
  return {
    chartUpdatedAt: UPDATED_AT,
    impactChartUuids: [CHART],
    fieldLists: [],
    previews: [],
    writes: [],
  };
}

function fakeLightdash(up: Upstream): LightdashClient {
  return {
    v1: {
      rename: {
        listChartFields: async (_projectUuid: string, chartUuid: string) => {
          up.fieldLists.push(`chart:${chartUuid}`);
          return { fields: FIELDS };
        },
        listDashboardFields: async (_projectUuid: string, dashboardUuid: string) => {
          up.fieldLists.push(`dashboard:${dashboardUuid}`);
          return { fields: FIELDS };
        },
        previewRename: async (_projectUuid: string, body: unknown) => {
          up.previews.push(body);
          return {
            alerts: [],
            charts: up.impactChartUuids.map((uuid) => ({ name: 'Orders', uuid })),
            dashboardSchedulers: [],
            dashboards: [{ name: 'Sales', uuid: DASHBOARD }],
          };
        },
        renameChart: async (_projectUuid: string, chartUuid: string, body: unknown) => {
          up.writes.push({ endpoint: `rename/chart/${chartUuid}`, body });
          return {};
        },
        renameDashboardFilter: async (
          _projectUuid: string,
          dashboardUuid: string,
          body: unknown,
        ) => {
          up.writes.push({ endpoint: `rename/dashboard/${dashboardUuid}`, body });
          return {};
        },
        renameResources: async (_projectUuid: string, body: unknown) => {
          up.writes.push({ endpoint: 'rename', body });
          return { jobId: 'job-9' };
        },
      },
    },
    v2: {
      charts: {
        getSavedChart: async (_projectUuid: string, chartUuid: string) => ({
          uuid: chartUuid,
          updatedAt: up.chartUpdatedAt,
        }),
      },
      dashboards: {
        getDashboard: async (_projectUuid: string, dashboardUuid: string) => ({
          uuid: dashboardUuid,
          updatedAt: UPDATED_AT,
        }),
      },
    },
  } as unknown as LightdashClient;
}

async function connect(up: Upstream): Promise<{ server: McpServer; client: Client }> {
  const contextProvider: McpContextProvider = {
    getContext: async () => ({
      lightdashClient: fakeLightdash(up),
      auth: { mode: 'env' as const },
    }),
  };
  const server = createLightdashMcpServer(contextProvider, {
    profile: getProfile('content-developer'),
  });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'developer-rename-test', version: '0.0.0' });
  await client.connect(clientTransport);
  return { server, client };
}

describe('content-developer rename tools', () => {
  let up: Upstream;
  let session: { server: McpServer; client: Client };

  async function call(tool: string, args: Record<string, unknown>): Promise<ToolCall> {
    const result = await session.client.callTool({
      name: `lightdash_${tool}`,
      arguments: { projectUuid: PROJECT, ...args },
    });
    const structured = (result.structuredContent ?? {}) as {
      data?: Record<string, unknown>;
      error?: { code: string; message: string };
    };
    return {
      isError: result.isError === true,
      data: structured.data ?? {},
      error: structured.error,
    };
  }

  async function confirm(preview: ToolCall): Promise<string> {
    const confirmed = await call('confirm_preview', {
      previewToken: preview.data.previewToken,
      resourceKind: 'rename',
      resourceKey: preview.data.resourceKey,
    });
    expect(confirmed.data.status).toBe('validated');
    return String(confirmed.data.previewToken);
  }

  const chartRename = {
    chartUuid: CHART,
    type: 'field',
    from: 'customers_old',
    to: 'customers_region',
  };
  const projectRename = { type: 'field', from: 'orders_old', to: 'orders_status', model: 'orders' };

  beforeEach(async () => {
    resetPreviewLedgerForTests();
    up = createUpstream();
    session = await connect(up);
  });

  afterEach(async () => {
    await session.client.close().catch(() => undefined);
    await session.server.close().catch(() => undefined);
  });

  it('lists the chart dropdown, including joined tables', async () => {
    const listed = await call('list_rename_fields', { target: 'chart', chartUuid: CHART });
    expect(listed.data).toEqual({ fields: FIELDS });
    expect(up.fieldLists).toEqual([`chart:${CHART}`]);
  });

  it('renames a chart field to a joined-table id after confirm, without the project preview', async () => {
    const preview = await call('preview_rename', { scope: 'chart', ...chartRename });
    expect(preview.data).toMatchObject({
      resourceKind: 'rename',
      resourceKey: CHART,
      status: 'draft',
      fields: FIELDS,
    });
    expect(preview.data.previewToken).toEqual(expect.any(String));

    const applied = await call('rename_chart', {
      previewToken: await confirm(preview),
      ...chartRename,
    });
    expect(applied.data).toEqual({ applied: true, next: 'Run validate_chart on the saved chart.' });
    expect(up.writes).toEqual([
      {
        endpoint: `rename/chart/${CHART}`,
        body: { type: 'field', from: 'customers_old', to: 'customers_region' },
      },
    ]);
    expect(up.previews).toEqual([]);
  });

  it('rejects a new field id outside the dropdown before minting a token', async () => {
    const preview = await call('preview_rename', {
      scope: 'chart',
      ...chartRename,
      to: 'customers_missing',
    });
    expect(preview.error?.code).toBe('RENAME_FIELD_UNLISTED');
    expect(preview.data.previewToken).toBeUndefined();
    expect(up.fieldLists).toEqual([`chart:${CHART}`]);
  });

  it('previews a chart model rename without loading the dropdown', async () => {
    const preview = await call('preview_rename', {
      scope: 'chart',
      chartUuid: CHART,
      type: 'model',
      from: 'orders',
      to: 'orders_v2',
    });
    expect(preview.data).toMatchObject({ resourceKind: 'rename', status: 'draft' });
    expect(preview.data).not.toHaveProperty('fields');
    expect(up.fieldLists).toEqual([]);
  });

  it('rejects an empty or unchanged rename before minting a token', async () => {
    const empty = await call('preview_rename', { scope: 'chart', ...chartRename, from: '' });
    expect(empty.isError).toBe(true);
    expect(empty.data.previewToken).toBeUndefined();

    const unchanged = await call('preview_rename', {
      scope: 'chart',
      ...chartRename,
      from: 'customers_region',
    });
    expect(unchanged.error?.code).toBe('RENAME_UNCHANGED');
    expect(up.fieldLists).toEqual([]);
  });

  it('requires model for a project field rename', async () => {
    const preview = await call('preview_rename', {
      scope: 'project',
      ...projectRename,
      model: undefined,
    });
    expect(preview.error?.code).toBe('RENAME_TARGET');
    expect(up.previews).toEqual([]);
  });

  it('rejects a project field id that is not prefixed by the explore name', async () => {
    const preview = await call('preview_rename', {
      scope: 'project',
      ...projectRename,
      from: 'status',
    });
    expect(preview.error?.code).toBe('RENAME_TARGET');
    expect(up.previews).toEqual([]);
  });

  it('rejects a rename name that would be compiled as a pattern', async () => {
    const preview = await call('preview_rename', {
      scope: 'chart',
      ...chartRename,
      from: '.*',
    });
    expect(preview.error?.code).toBe('RENAME_TARGET');
    expect(up.fieldLists).toEqual([]);
  });

  it('does not post with an unconfirmed draft token', async () => {
    const preview = await call('preview_rename', { scope: 'chart', ...chartRename });
    const applied = await call('rename_chart', {
      previewToken: preview.data.previewToken,
      ...chartRename,
    });
    expect(applied.error?.code).toBe('PREVIEW_NOT_VALIDATED');
    expect(up.writes).toEqual([]);
  });

  it('fails closed with PREVIEW_STALE when the chart changed after preview', async () => {
    const preview = await call('preview_rename', { scope: 'chart', ...chartRename });
    const previewToken = await confirm(preview);
    up.chartUpdatedAt = '2026-10-02T00:00:00.000Z';
    const applied = await call('rename_chart', { previewToken, ...chartRename });
    expect(applied.error?.code).toBe('PREVIEW_STALE');
    expect(up.writes).toEqual([]);
  });

  it('unlocks only the rename that was previewed', async () => {
    const preview = await call('preview_rename', { scope: 'chart', ...chartRename });
    const previewToken = await confirm(preview);
    const otherTarget = await call('rename_chart', {
      previewToken,
      ...chartRename,
      to: 'orders_status',
    });
    expect(otherTarget.error?.code).toBe('PREVIEW_STALE');
    const otherTool = await call('rename_project', { previewToken, ...projectRename });
    expect(otherTool.error?.code).toBe('PREVIEW_STALE');
    expect(up.writes).toEqual([]);
  });

  it('rejects dryRun on apply and does not post', async () => {
    const preview = await call('preview_rename', { scope: 'chart', ...chartRename });
    const applied = await call('rename_chart', {
      previewToken: await confirm(preview),
      ...chartRename,
      dryRun: true,
    });
    expect(applied.error?.code).toBe('RENAME_DRY_RUN');
    expect(up.writes).toEqual([]);
  });

  it('renames a dashboard filter after confirm', async () => {
    const rename = {
      dashboardUuid: DASHBOARD,
      type: 'field',
      from: 'orders_old',
      to: 'orders_status',
    };
    const preview = await call('preview_rename', { scope: 'dashboard-filter', ...rename });
    expect(preview.data.resourceKey).toBe(DASHBOARD);
    const applied = await call('rename_dashboard_filter', {
      previewToken: await confirm(preview),
      ...rename,
    });
    expect(applied.data).toEqual({
      applied: true,
      next: 'Run validate_dashboard on the saved dashboard.',
    });
    expect(up.writes).toEqual([
      {
        endpoint: `rename/dashboard/${DASHBOARD}`,
        body: { type: 'field', from: 'orders_old', to: 'orders_status' },
      },
    ]);
    expect(up.fieldLists).toEqual([`dashboard:${DASHBOARD}`]);
    expect(up.previews).toEqual([]);
  });

  it('rechecks the project uuid lists, posts once, and returns jobId without polling', async () => {
    const preview = await call('preview_rename', { scope: 'project', ...projectRename });
    expect(preview.data).toMatchObject({
      resourceKey: 'project:field:orders:orders_old:orders_status',
      impact: { alerts: [], charts: [CHART], dashboardSchedulers: [], dashboards: [DASHBOARD] },
    });
    const applied = await call('rename_project', {
      previewToken: await confirm(preview),
      ...projectRename,
    });
    expect(applied.data.jobId).toBe('job-9');
    expect(applied.data.next).toContain('lightdash download');
    const dryRunBody = {
      type: 'field',
      from: 'orders_old',
      to: 'orders_status',
      model: 'orders',
      dryRun: true,
    };
    expect(up.previews).toEqual([dryRunBody, dryRunBody]);
    expect(up.writes).toEqual([
      {
        endpoint: 'rename',
        body: { type: 'field', from: 'old', to: 'status', model: 'orders' },
      },
    ]);
  });

  it('returns PREVIEW_STALE and does not post when the project uuid list changed', async () => {
    const preview = await call('preview_rename', { scope: 'project', ...projectRename });
    const previewToken = await confirm(preview);
    up.impactChartUuids = [CHART, OTHER_CHART];
    const applied = await call('rename_project', { previewToken, ...projectRename });
    expect(applied.error?.code).toBe('PREVIEW_STALE');
    expect(up.previews).toHaveLength(2);
    expect(up.writes).toEqual([]);
  });
});
