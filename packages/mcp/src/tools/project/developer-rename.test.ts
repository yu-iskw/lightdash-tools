/**
 * Rename handler tests against the real in-memory preview ledger.
 * The RenameApi is a hand-written recorder. The ledger is not mocked.
 */

import { LightdashApiError } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PreviewLedgerError,
  getOwnedPreview,
  markPreviewValidated,
  resetPreviewLedgerForTests,
} from '../../policy/preview-ledger.js';
import { getPreviewStore, setPreviewStoreForTests } from '../../store/create-preview-store.js';
import { InMemoryPreviewStore } from '../../store/in-memory-preview-store.js';

import {
  RenameRejectedError,
  applyChartRename,
  applyDashboardFilterRename,
  applyProjectRename,
  issueRenamePreview,
} from './developer-rename.js';

import type { RenameApi } from './developer-rename.js';
import type { PreviewLedgerEntry } from '../../policy/preview-ledger.js';
import type { ApiErrorPayload } from '@lightdash-tools/client';

const SESSION = 'session-1';
const PROJECT = 'p1';
const UPDATED_AT = '2026-10-01T00:00:00.000Z';

type RenameCalls = {
  previewRename: number;
  renameChart: number;
  renameDashboardFilter: number;
  renameResources: number;
  listChartFields: number;
};

class CountingPreviewStore extends InMemoryPreviewStore {
  puts = 0;

  override async put(entry: PreviewLedgerEntry): Promise<void> {
    this.puts += 1;
    await super.put(entry);
  }
}

function apiError(statusCode: number): LightdashApiError {
  const payload: ApiErrorPayload['error'] = {
    name: 'ApiError',
    statusCode,
    message: `status ${statusCode}`,
  };
  return new LightdashApiError(statusCode, payload, {});
}

function impact(chartUuid: string, dashboardUuid: string) {
  return {
    alerts: [] as { name: string; uuid: string }[],
    charts: [{ name: 'chart', uuid: chartUuid }],
    dashboardSchedulers: [] as { name: string; uuid: string }[],
    dashboards: [{ name: 'dashboard', uuid: dashboardUuid }],
  };
}

function createRenameApi(options?: {
  updatedAt?: string;
  tableName?: string;
  renameChartError?: LightdashApiError;
  previewChartUuids?: string[];
}): { api: RenameApi; calls: RenameCalls } {
  const calls: RenameCalls = {
    previewRename: 0,
    renameChart: 0,
    renameDashboardFilter: 0,
    renameResources: 0,
    listChartFields: 0,
  };
  const [firstChart = 'c1', secondChart = firstChart] = options?.previewChartUuids ?? ['c1'];
  const api: RenameApi = {
    listChartFields: () => {
      calls.listChartFields += 1;
      return Promise.resolve({ fields: { orders: ['orders_old', 'orders_new'] } });
    },
    listDashboardFields: () =>
      Promise.resolve({ fields: { orders: ['orders_old', 'orders_new'] } }),
    previewRename: () => {
      calls.previewRename += 1;
      const chartUuid = calls.previewRename === 1 ? firstChart : secondChart;
      return Promise.resolve(impact(chartUuid, 'd1'));
    },
    renameChart: () => {
      calls.renameChart += 1;
      if (options?.renameChartError) {
        return Promise.reject(options.renameChartError);
      }
      return Promise.resolve({});
    },
    renameDashboardFilter: () => {
      calls.renameDashboardFilter += 1;
      return Promise.resolve({});
    },
    renameResources: () => {
      calls.renameResources += 1;
      return Promise.resolve({ jobId: 'job-9' });
    },
    getSavedChart: () =>
      Promise.resolve({
        uuid: 'c1',
        updatedAt: options?.updatedAt ?? UPDATED_AT,
        tableName: options?.tableName ?? 'orders',
      }),
    getDashboard: () => Promise.resolve({ uuid: 'd1', updatedAt: UPDATED_AT }),
  };
  return { api, calls };
}

async function expectRejectCode(fn: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await fn();
    expect.unreachable(`expected ${code}`);
  } catch (err) {
    if (err instanceof RenameRejectedError || err instanceof PreviewLedgerError) {
      expect(err.code).toBe(code);
      return;
    }
    throw err;
  }
}

async function previewChart(api: RenameApi, from = 'orders_old', to = 'orders_new') {
  return issueRenamePreview(api, {
    sessionId: SESSION,
    projectUuid: PROJECT,
    scope: 'chart',
    type: 'field',
    from,
    to,
    chartUuid: 'c1',
  });
}

async function confirmRename(previewId: string, resourceKey: string): Promise<void> {
  await markPreviewValidated(previewId, SESSION, PROJECT, {
    resourceKind: 'rename',
    resourceKey,
  });
}

describe('developer rename handlers', () => {
  beforeEach(() => {
    resetPreviewLedgerForTests();
  });

  it('chart preview does not call previewRename', async () => {
    const { api, calls } = createRenameApi();
    const preview = await previewChart(api);
    expect(preview.resourceKind).toBe('rename');
    expect(calls.previewRename).toBe(0);
  });

  it('rejects from===to with RENAME_UNCHANGED before a ledger row', async () => {
    const store = new CountingPreviewStore();
    setPreviewStoreForTests(store);
    const { api, calls } = createRenameApi();
    await expectRejectCode(() => previewChart(api, 'orders_old', 'orders_old'), 'RENAME_UNCHANGED');
    expect(store.puts).toBe(0);
    expect(calls.previewRename).toBe(0);
  });

  it('accepts a joined-table field id when the new id is in the dropdown', async () => {
    const { api, calls } = createRenameApi();
    api.listChartFields = () => {
      calls.listChartFields += 1;
      return Promise.resolve({
        fields: { orders: ['orders_id'], customers: ['customers_new'] },
      });
    };
    const preview = await previewChart(api, 'customers_old', 'customers_new');
    expect(preview.resourceKind).toBe('rename');
    expect(calls.previewRename).toBe(0);
  });

  it('rejects a new field id that is not in the chart dropdown', async () => {
    const { api } = createRenameApi();
    await expectRejectCode(
      () => previewChart(api, 'customers_old', 'customers_missing'),
      'RENAME_FIELD_PREFIX',
    );
  });

  it('stores a chart model rename without loading the field dropdown', async () => {
    const { api, calls } = createRenameApi();
    api.listChartFields = () => Promise.reject(new Error('explore missing'));
    const preview = await issueRenamePreview(api, {
      sessionId: SESSION,
      projectUuid: PROJECT,
      scope: 'chart',
      type: 'model',
      from: 'orders',
      to: 'orders_v2',
      chartUuid: 'c1',
    });
    expect(preview.previewId).toBeTruthy();
    expect(calls.listChartFields).toBe(0);
  });

  it('rejects an empty from before a ledger row', async () => {
    const store = new CountingPreviewStore();
    setPreviewStoreForTests(store);
    const { api } = createRenameApi();
    await expectRejectCode(() => previewChart(api, '', 'orders_new'), 'RENAME_TARGET');
    expect(store.puts).toBe(0);
  });

  it('rejects a project field rename that omits model', async () => {
    const { api, calls } = createRenameApi();
    await expectRejectCode(
      () =>
        issueRenamePreview(api, {
          sessionId: SESSION,
          projectUuid: PROJECT,
          scope: 'project',
          type: 'field',
          from: 'orders_old',
          to: 'orders_new',
        }),
      'RENAME_TARGET',
    );
    expect(calls.previewRename).toBe(0);
  });

  it('posts rename_chart once after confirm and does not post again', async () => {
    const { api, calls } = createRenameApi();
    const preview = await previewChart(api);
    await confirmRename(preview.previewId, preview.resourceKey);
    const applied = await applyChartRename(api, {
      previewId: preview.previewId,
      sessionId: SESSION,
      projectUuid: PROJECT,
      chartUuid: 'c1',
      type: 'field',
      from: 'orders_old',
      to: 'orders_new',
    });
    expect(applied.applied).toBe(true);
    expect(calls.renameChart).toBe(1);

    await expectRejectCode(
      () =>
        applyChartRename(api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          chartUuid: 'c1',
          type: 'field',
          from: 'orders_old',
          to: 'orders_new',
        }),
      'PREVIEW_REQUIRED',
    );
    expect(calls.renameChart).toBe(1);
  });

  it('rejects an unconfirmed preview with PREVIEW_NOT_VALIDATED', async () => {
    const { api, calls } = createRenameApi();
    const preview = await previewChart(api);
    await expectRejectCode(
      () =>
        applyChartRename(api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          chartUuid: 'c1',
          type: 'field',
          from: 'orders_old',
          to: 'orders_new',
        }),
      'PREVIEW_NOT_VALIDATED',
    );
    expect(calls.renameChart).toBe(0);
  });

  it('rejects a stale updatedAt with PREVIEW_STALE', async () => {
    const { api, calls } = createRenameApi();
    const preview = await previewChart(api);
    await confirmRename(preview.previewId, preview.resourceKey);
    const drifted = createRenameApi({ updatedAt: '2026-10-02T00:00:00.000Z' });
    await expectRejectCode(
      () =>
        applyChartRename(drifted.api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          chartUuid: 'c1',
          type: 'field',
          from: 'orders_old',
          to: 'orders_new',
        }),
      'PREVIEW_STALE',
    );
    expect(calls.renameChart).toBe(0);
    expect(drifted.calls.renameChart).toBe(0);
  });

  it('returns a 4xx chart rename to validated', async () => {
    const { api } = createRenameApi({ renameChartError: apiError(400) });
    const preview = await previewChart(api);
    await confirmRename(preview.previewId, preview.resourceKey);
    await expect(
      applyChartRename(api, {
        previewId: preview.previewId,
        sessionId: SESSION,
        projectUuid: PROJECT,
        chartUuid: 'c1',
        type: 'field',
        from: 'orders_old',
        to: 'orders_new',
      }),
    ).rejects.toBeInstanceOf(LightdashApiError);
    const stored = await getOwnedPreview({
      previewId: preview.previewId,
      sessionId: SESSION,
      projectUuid: PROJECT,
    });
    expect(stored.status).toBe('validated');
  });

  it('marks a 5xx chart rename reconciliation_required', async () => {
    const { api } = createRenameApi({ renameChartError: apiError(500) });
    const preview = await previewChart(api);
    await confirmRename(preview.previewId, preview.resourceKey);
    await expect(
      applyChartRename(api, {
        previewId: preview.previewId,
        sessionId: SESSION,
        projectUuid: PROJECT,
        chartUuid: 'c1',
        type: 'field',
        from: 'orders_old',
        to: 'orders_new',
      }),
    ).rejects.toBeInstanceOf(LightdashApiError);
    const stored = await getPreviewStore().get(preview.previewId);
    expect(stored?.status).toBe('reconciliation_required');
  });

  it('rejects a project instruction passed to applyChartRename with RENAME_SCOPE', async () => {
    const { api, calls } = createRenameApi();
    const preview = await issueRenamePreview(api, {
      sessionId: SESSION,
      projectUuid: PROJECT,
      scope: 'project',
      type: 'field',
      from: 'old',
      to: 'new',
      model: 'orders',
    });
    await confirmRename(preview.previewId, preview.resourceKey);
    await expectRejectCode(
      () =>
        applyChartRename(api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          chartUuid: 'c1',
          type: 'field',
          from: 'old',
          to: 'new',
        }),
      'RENAME_SCOPE',
    );
    expect(calls.renameChart).toBe(0);
  });

  it('rejects dryRun on apply with RENAME_DRY_RUN and does not post', async () => {
    const { api, calls } = createRenameApi();
    const preview = await previewChart(api);
    await confirmRename(preview.previewId, preview.resourceKey);
    await expectRejectCode(
      () =>
        applyChartRename(api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          chartUuid: 'c1',
          type: 'field',
          from: 'orders_old',
          to: 'orders_new',
          dryRun: true,
        }),
      'RENAME_DRY_RUN',
    );
    expect(calls.renameChart).toBe(0);
  });

  it('does not call renameResources when the project uuid list changed', async () => {
    const { api, calls } = createRenameApi({ previewChartUuids: ['c1', 'c2'] });
    const preview = await issueRenamePreview(api, {
      sessionId: SESSION,
      projectUuid: PROJECT,
      scope: 'project',
      type: 'field',
      from: 'old',
      to: 'new',
      model: 'orders',
    });
    await confirmRename(preview.previewId, preview.resourceKey);
    await expectRejectCode(
      () =>
        applyProjectRename(api, {
          previewId: preview.previewId,
          sessionId: SESSION,
          projectUuid: PROJECT,
          type: 'field',
          from: 'old',
          to: 'new',
          model: 'orders',
        }),
      'PREVIEW_STALE',
    );
    expect(calls.renameResources).toBe(0);
  });

  it('posts a confirmed dashboard filter rename once', async () => {
    const { api, calls } = createRenameApi();
    const preview = await issueRenamePreview(api, {
      sessionId: SESSION,
      projectUuid: PROJECT,
      scope: 'dashboard-filter',
      type: 'field',
      from: 'orders_old',
      to: 'orders_new',
      dashboardUuid: 'd1',
    });
    await confirmRename(preview.previewId, preview.resourceKey);
    const applied = await applyDashboardFilterRename(api, {
      previewId: preview.previewId,
      sessionId: SESSION,
      projectUuid: PROJECT,
      dashboardUuid: 'd1',
      type: 'field',
      from: 'orders_old',
      to: 'orders_new',
    });
    expect(applied.next).toContain('validate_dashboard');
    expect(calls.renameDashboardFilter).toBe(1);
    expect(calls.previewRename).toBe(0);
  });

  it('returns jobId after a successful project rename', async () => {
    const { api, calls } = createRenameApi();
    const preview = await issueRenamePreview(api, {
      sessionId: SESSION,
      projectUuid: PROJECT,
      scope: 'project',
      type: 'field',
      from: 'old',
      to: 'new',
      model: 'orders',
    });
    await confirmRename(preview.previewId, preview.resourceKey);
    const applied = await applyProjectRename(api, {
      previewId: preview.previewId,
      sessionId: SESSION,
      projectUuid: PROJECT,
      type: 'field',
      from: 'old',
      to: 'new',
      model: 'orders',
    });
    expect(applied.jobId).toBe('job-9');
    expect(calls.renameResources).toBe(1);
  });
});
