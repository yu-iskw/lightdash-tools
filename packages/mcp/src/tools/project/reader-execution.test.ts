/**
 * Unit tests for content-reader run_chart / run_dashboard_tile opaque SQL paths.
 */

import { LightdashApiError } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveProjectScopeMock,
  registerContentReaderToolMock,
  wrapToolMock,
  resolveChartSourceMock,
  runBoundedSavedQueryMock,
} = vi.hoisted(() => ({
  resolveProjectScopeMock: vi.fn(),
  registerContentReaderToolMock: vi.fn(),
  wrapToolMock: vi.fn(),
  resolveChartSourceMock: vi.fn(),
  runBoundedSavedQueryMock: vi.fn(),
}));

vi.mock('../../governance/project-scope.js', () => ({
  resolveProjectScope: resolveProjectScopeMock,
  ProjectScopeError: class ProjectScopeError extends Error {
    code = 'PROJECT_SCOPE_REQUIRED';
  },
}));

vi.mock('../../policy/content-reader.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    registerContentReaderTool: registerContentReaderToolMock,
  };
});

vi.mock('../shared.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    wrapTool: wrapToolMock,
  };
});

vi.mock('../query/chart-source.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    resolveChartSource: resolveChartSourceMock,
  };
});

vi.mock('../query/bounded-saved-query.js', () => ({
  runBoundedSavedQuery: runBoundedSavedQueryMock,
}));

import { registerRunChart, registerRunDashboardTile } from './reader-execution.js';

function parseToolJson(result: unknown): Record<string, unknown> {
  const content = (result as { content: Array<{ text: string }> }).content;
  return JSON.parse(content[0].text) as Record<string, unknown>;
}

describe('registerRunChart opaque SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectScopeMock.mockReturnValue({
      projectUuid: 'proj-1',
      projectPinned: false,
    });
    wrapToolMock.mockImplementation(
      (_ctx: unknown, factory: (c: unknown) => (args: unknown) => Promise<unknown>) => {
        return async (args: unknown) => {
          const client = (wrapToolMock as { __client?: unknown }).__client;
          return factory(client)(args);
        };
      },
    );
  });

  function captureHandler(client: unknown): (args: Record<string, unknown>) => Promise<unknown> {
    (wrapToolMock as { __client?: unknown }).__client = client;
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
    registerContentReaderToolMock.mockImplementation(
      (
        _server: unknown,
        _name: unknown,
        _meta: unknown,
        createHandler: (profile: string) => typeof handler,
      ) => {
        handler = createHandler('content-reader');
      },
    );
    registerRunChart({} as never, {} as never);
    expect(handler).toBeDefined();
    return handler!;
  }

  it('routes SQL charts to runSqlChartQuery without getSavedChart', async () => {
    const runSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sql' });
    const getSavedChart = vi.fn();
    resolveChartSourceMock.mockResolvedValue({
      class: 'sql',
      uuid: 'sql-uuid-1',
      slug: 'my-sql-chart',
      name: 'Cost chart',
    });
    runBoundedSavedQueryMock.mockImplementation(
      async (opts: { execute: () => Promise<unknown> }) => {
        await opts.execute();
        return {
          ok: true,
          normalized: {
            status: 'complete',
            queryUuid: 'q-sql',
            rows: [{ v: 1 }],
            truncated: false,
          },
          warnings: [],
        };
      },
    );

    const handler = captureHandler({
      v2: {
        charts: { getSavedChart },
        query: { runSqlChartQuery, runChartQuery: vi.fn() },
      },
    });
    const result = await handler({ chartUuidOrSlug: 'sql-uuid-1', limit: 10 });
    const body = parseToolJson(result);

    expect(getSavedChart).not.toHaveBeenCalled();
    expect(runSqlChartQuery).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        savedSqlUuid: 'sql-uuid-1',
        limit: 10,
        invalidateCache: false,
        context: 'sqlChartView',
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(/"sql"\s*:/);
    const warnings = (body.warnings as Array<{ code: string }>) ?? [];
    expect(warnings.some((w) => w.code === 'SQL_BODY_REDACTED')).toBe(true);
  });

  it('keeps semantic charts on runChartQuery', async () => {
    const runChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sem' });
    const runSqlChartQuery = vi.fn();
    resolveChartSourceMock.mockResolvedValue({
      class: 'semantic',
      uuid: 'chart-1',
      name: 'App DAU',
    });
    runBoundedSavedQueryMock.mockImplementation(
      async (opts: { execute: () => Promise<unknown> }) => {
        await opts.execute();
        return {
          ok: true,
          normalized: {
            status: 'complete',
            queryUuid: 'q-sem',
            rows: [{ dau: 100 }],
            truncated: false,
          },
          warnings: [],
        };
      },
    );

    const handler = captureHandler({
      v2: {
        charts: {
          getSavedChart: vi.fn().mockResolvedValue({
            uuid: 'chart-1',
            name: 'App DAU',
            metricQuery: { dimensions: [], metrics: ['m'] },
            chartConfig: { type: 'cartesian' },
          }),
        },
        query: { runChartQuery, runSqlChartQuery },
      },
    });
    await handler({ chartUuidOrSlug: 'chart-1' });
    expect(runSqlChartQuery).not.toHaveBeenCalled();
    expect(runChartQuery).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        chartUuid: 'chart-1',
        context: 'chartView',
        invalidateCache: false,
      }),
    );
  });

  it('falls back to runSqlChartQuery when search misses and semantic GET 404s', async () => {
    const runSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sql' });
    const getSavedChart = vi
      .fn()
      .mockRejectedValue(
        new LightdashApiError(
          404,
          { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
          {},
        ),
      );
    resolveChartSourceMock.mockResolvedValue({ class: 'unknown' });
    runBoundedSavedQueryMock.mockImplementation(
      async (opts: { execute: () => Promise<unknown> }) => {
        await opts.execute();
        return {
          ok: true,
          normalized: {
            status: 'complete',
            queryUuid: 'q-sql',
            rows: [{ v: 1 }],
            truncated: false,
          },
          warnings: [],
        };
      },
    );

    const handler = captureHandler({
      v2: {
        charts: { getSavedChart },
        query: { runSqlChartQuery, runChartQuery: vi.fn() },
      },
    });
    const result = await handler({
      chartUuidOrSlug: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      limit: 5,
    });
    const body = parseToolJson(result);
    expect(runSqlChartQuery).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        savedSqlUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        context: 'sqlChartView',
      }),
    );
    const warnings = (body.warnings as Array<{ code: string }>) ?? [];
    expect(warnings.some((w) => w.code === 'SQL_BODY_REDACTED')).toBe(true);
  });
});

describe('registerRunDashboardTile opaque SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectScopeMock.mockReturnValue({
      projectUuid: 'proj-1',
      projectPinned: false,
    });
    wrapToolMock.mockImplementation(
      (_ctx: unknown, factory: (c: unknown) => (args: unknown) => Promise<unknown>) => {
        return async (args: unknown) => {
          const client = (wrapToolMock as { __client?: unknown }).__client;
          return factory(client)(args);
        };
      },
    );
  });

  function captureHandler(client: unknown): (args: Record<string, unknown>) => Promise<unknown> {
    (wrapToolMock as { __client?: unknown }).__client = client;
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
    registerContentReaderToolMock.mockImplementation(
      (
        _server: unknown,
        _name: unknown,
        _meta: unknown,
        createHandler: (profile: string) => typeof handler,
      ) => {
        handler = createHandler('content-reader');
      },
    );
    registerRunDashboardTile({} as never, {} as never);
    expect(handler).toBeDefined();
    return handler!;
  }

  it('routes sql_chart tiles to runDashboardSqlChartQuery', async () => {
    const runDashboardSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-tile' });
    const runDashboardChartQuery = vi.fn();
    runBoundedSavedQueryMock.mockImplementation(
      async (opts: { execute: () => Promise<unknown> }) => {
        await opts.execute();
        return {
          ok: true,
          normalized: {
            status: 'complete',
            queryUuid: 'q-tile',
            rows: [{ cost: 2 }],
            truncated: false,
          },
          warnings: [],
        };
      },
    );

    const handler = captureHandler({
      v2: {
        dashboards: {
          getDashboard: vi.fn().mockResolvedValue({
            uuid: 'dash-1',
            name: 'App',
            filters: { dimensions: [], metrics: [], tableCalculations: [] },
            tiles: [
              {
                uuid: 'tile-sql-1',
                type: 'sql_chart',
                properties: {
                  savedSqlUuid: 'saved-sql-1',
                  chartName: 'Latency',
                },
              },
            ],
          }),
        },
        query: { runDashboardSqlChartQuery, runDashboardChartQuery },
      },
    });

    const result = await handler({
      dashboardUuidOrSlug: 'dash-1',
      tileUuid: 'tile-sql-1',
      limit: 5,
    });
    const body = parseToolJson(result);

    expect(runDashboardChartQuery).not.toHaveBeenCalled();
    expect(runDashboardSqlChartQuery).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        savedSqlUuid: 'saved-sql-1',
        dashboardUuid: 'dash-1',
        tileUuid: 'tile-sql-1',
        context: 'dashboardView',
        invalidateCache: false,
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(/"sql"\s*:/);
    const warnings = (body.warnings as Array<{ code: string }>) ?? [];
    expect(warnings.some((w) => w.code === 'SQL_BODY_REDACTED')).toBe(true);
  });
});
