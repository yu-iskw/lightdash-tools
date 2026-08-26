/**
 * run_chart / run_dashboard_tile registration and handler tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import {
  resolveMcpClientSessionId,
  runWithMcpClientSessionAsync,
} from '../../governance/mcp-client-session.js';
import { resetQueryBudgetsForTests } from '../../policy/result-limits.js';
import { resetQueryLedgerForTests } from '../query/query-ledger.js';

import { registerRunChart, registerRunDashboardTile } from './reader-execution.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PROJECT = '550e8400-e29b-41d4-a716-446655440000';
const DASHBOARD = 'aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const TILE_SQL = 'bbbb2222-cccc-4ddd-8eee-ffffffffffff';
const TILE_SEM = 'cccc3333-dddd-4eee-8fff-aaaaaaaaaaaa';
const TILE_MD = 'dddd4444-eeee-4fff-8aaa-bbbbbbbbbbbb';
const TILE_SQL_MISSING = 'eeee5555-ffff-4aaa-8bbb-cccccccccccc';
const SAVED_SQL = 'ffff6666-aaaa-4bbb-8ccc-dddddddddddd';
const SAVED_CHART = '1111aaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const dashboardFixture = {
  uuid: DASHBOARD,
  name: 'App',
  tiles: [
    {
      uuid: TILE_SQL,
      type: 'sql_chart',
      properties: { savedSqlUuid: SAVED_SQL, chartSlug: 'sql-kpi', chartName: 'SQL KPI' },
    },
    {
      uuid: TILE_SEM,
      type: 'saved_chart',
      properties: { savedChartUuid: SAVED_CHART, chartName: 'Revenue' },
    },
    {
      uuid: TILE_MD,
      type: 'markdown',
      properties: { title: 'Notes' },
    },
    {
      uuid: TILE_SQL_MISSING,
      type: 'sql_chart',
      properties: { chartName: 'Broken SQL tile' },
    },
  ],
  filters: { dimensions: [], metrics: [], tableCalculations: [] },
};

function readerContext(lightdashClient: unknown): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient,
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

function registerDashboardTileHandler(lightdashClient: unknown) {
  const mockServer = { registerTool: vi.fn() };
  bindServerProfile(mockServer, 'content-reader');
  registerRunDashboardTile(mockServer as never, readerContext(lightdashClient));
  const [toolName, , handler] = mockServer.registerTool.mock.calls[0];
  expect(toolName).toBe('lightdash_run_dashboard_tile');
  return handler as (args: Record<string, unknown>) => Promise<{
    isError?: boolean;
    content: Array<{
      type?: string;
      text?: string;
      resource?: { text?: string; mimeType?: string };
    }>;
    structuredContent?: Record<string, unknown>;
  }>;
}

describe('registerRunDashboardTile', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
    vi.restoreAllMocks();
  });

  it('executes sql_chart tiles via runDashboardSqlChartQuery', async () => {
    const runDashboardSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sql' });
    const runDashboardChartQuery = vi.fn();
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q-sql',
      status: 'ready',
      columns: {},
      rows: [{ metric: 1 }],
      totalResults: 1,
    });
    const getDashboard = vi.fn().mockResolvedValue(dashboardFixture);

    const handler = registerDashboardTileHandler({
      v2: {
        dashboards: { getDashboard },
        query: { runDashboardSqlChartQuery, runDashboardChartQuery, getAsyncQueryResults },
      },
    });

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-reader-sql-1' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await handler({
        projectUuid: PROJECT,
        dashboardUuidOrSlug: DASHBOARD,
        tileUuid: TILE_SQL,
        waitForResults: true,
        timeoutMs: 5_000,
      });

      expect(result.isError).toBeUndefined();
      expect(runDashboardSqlChartQuery).toHaveBeenCalledWith(
        PROJECT,
        expect.objectContaining({
          savedSqlUuid: SAVED_SQL,
          dashboardUuid: DASHBOARD,
          tileUuid: TILE_SQL,
          dashboardSorts: [],
          invalidateCache: false,
          context: 'dashboardView',
        }),
      );
      expect(runDashboardChartQuery).not.toHaveBeenCalled();

      const body = JSON.parse(result.content[0].text!) as {
        data: { queryUuid: string; content: Record<string, unknown>; rows?: unknown };
        warnings: Array<{ code: string }>;
        artifacts: Array<{ kind: string; included: boolean }>;
      };
      expect(body.data.queryUuid).toBe('q-sql');
      expect(body.data.content).toMatchObject({
        type: 'dashboard_tile',
        savedSqlUuid: SAVED_SQL,
        tileUuid: TILE_SQL,
      });
      expect(body.data.content).not.toHaveProperty('chartUuid');
      expect(body.data.rows).toBeUndefined();
      expect(body.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'data', included: true }),
          expect.objectContaining({ kind: 'sql', included: false }),
        ]),
      );
      expect(result.content.some((c) => c.type === 'resource')).toBe(true);
      expect(body.warnings.map((w) => w.code)).toEqual(
        expect.arrayContaining(['SQL_RESULT_MAY_BE_ROW_LEVEL', 'SQL_ARTIFACT_AVAILABLE']),
      );
    });
  });

  it('attaches authored SQL resource when includeArtifacts includes sql', async () => {
    const runDashboardSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sql-art' });
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q-sql-art',
      status: 'ready',
      columns: {},
      rows: [{ metric: 2 }],
      totalResults: 1,
    });
    const getSavedSqlChart = vi.fn().mockResolvedValue({
      savedSqlUuid: SAVED_SQL,
      name: 'SQL KPI',
      slug: 'sql-kpi',
      sql: 'SELECT metric FROM kpi',
      limit: 500,
    });

    const handler = registerDashboardTileHandler({
      v1: { sqlRunner: { getSavedSqlChart } },
      v2: {
        dashboards: { getDashboard: vi.fn().mockResolvedValue(dashboardFixture) },
        query: { runDashboardSqlChartQuery, getAsyncQueryResults },
      },
    });

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-reader-sql-art' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await handler({
        projectUuid: PROJECT,
        dashboardUuidOrSlug: DASHBOARD,
        tileUuid: TILE_SQL,
        waitForResults: true,
        includeArtifacts: ['data', 'sql'],
      });

      expect(result.isError).toBeUndefined();
      expect(getSavedSqlChart).toHaveBeenCalledWith(PROJECT, SAVED_SQL);
      const sqlPart = result.content.find(
        (c) => c.type === 'resource' && c.resource?.mimeType === 'text/sql',
      );
      expect(sqlPart?.resource?.text).toBe('SELECT metric FROM kpi');
      const summary = JSON.parse(result.content[0].text!) as {
        warnings: Array<{ code: string }>;
        artifacts: Array<{ kind: string; included: boolean }>;
      };
      expect(summary.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'sql', included: true }),
          expect.objectContaining({ kind: 'data', included: true }),
        ]),
      );
      expect(summary.warnings.map((w) => w.code)).not.toContain('SQL_ARTIFACT_AVAILABLE');
    });
  });

  it('warns and ignores dateZoom on sql_chart tiles', async () => {
    const runDashboardSqlChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sql-zoom' });
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q-sql-zoom',
      status: 'ready',
      columns: {},
      rows: [],
      totalResults: 0,
    });

    const handler = registerDashboardTileHandler({
      v2: {
        dashboards: { getDashboard: vi.fn().mockResolvedValue(dashboardFixture) },
        query: { runDashboardSqlChartQuery, getAsyncQueryResults },
      },
    });

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-reader-sql-zoom' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await handler({
        projectUuid: PROJECT,
        dashboardUuidOrSlug: DASHBOARD,
        tileUuid: TILE_SQL,
        dateZoom: { granularity: 'week' },
        waitForResults: true,
      });

      expect(result.isError).toBeUndefined();
      const [, body] = runDashboardSqlChartQuery.mock.calls[0] as [string, Record<string, unknown>];
      expect(body).not.toHaveProperty('dateZoom');
      const parsed = JSON.parse(result.content[0].text!) as {
        warnings: Array<{ code: string }>;
      };
      expect(parsed.warnings.map((w) => w.code)).toEqual(
        expect.arrayContaining([
          'DATE_ZOOM_IGNORED',
          'SQL_RESULT_MAY_BE_ROW_LEVEL',
          'SQL_ARTIFACT_AVAILABLE',
        ]),
      );
    });
  });

  it('returns CONTENT_NOT_EXECUTABLE when sql_chart has no savedSqlUuid', async () => {
    const runDashboardSqlChartQuery = vi.fn();
    const handler = registerDashboardTileHandler({
      v2: {
        dashboards: { getDashboard: vi.fn().mockResolvedValue(dashboardFixture) },
        query: { runDashboardSqlChartQuery },
      },
    });

    const result = await handler({
      projectUuid: PROJECT,
      dashboardUuidOrSlug: DASHBOARD,
      tileUuid: TILE_SQL_MISSING,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('CONTENT_NOT_EXECUTABLE');
    expect(JSON.stringify(result)).toContain('saved SQL UUID');
    expect(runDashboardSqlChartQuery).not.toHaveBeenCalled();
  });

  it('executes saved_chart tiles via runDashboardChartQuery', async () => {
    const runDashboardChartQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-sem' });
    const runDashboardSqlChartQuery = vi.fn();
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q-sem',
      status: 'ready',
      columns: {},
      rows: [{ revenue: 10 }],
      totalResults: 1,
    });

    const handler = registerDashboardTileHandler({
      v2: {
        dashboards: { getDashboard: vi.fn().mockResolvedValue(dashboardFixture) },
        query: { runDashboardChartQuery, runDashboardSqlChartQuery, getAsyncQueryResults },
      },
    });

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-reader-sem-1' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await handler({
        projectUuid: PROJECT,
        dashboardUuidOrSlug: DASHBOARD,
        tileUuid: TILE_SEM,
        waitForResults: true,
      });

      expect(result.isError).toBeUndefined();
      expect(runDashboardChartQuery).toHaveBeenCalledWith(
        PROJECT,
        expect.objectContaining({
          chartUuid: SAVED_CHART,
          tileUuid: TILE_SEM,
          context: 'dashboardView',
        }),
      );
      expect(runDashboardSqlChartQuery).not.toHaveBeenCalled();
      const body = JSON.parse(result.content[0].text!) as {
        data: { content: Record<string, unknown>; rows?: unknown };
        artifacts: Array<{ kind: string; included: boolean }>;
      };
      expect(body.data.content).toMatchObject({ chartUuid: SAVED_CHART });
      expect(body.data.rows).toBeUndefined();
      expect(body.artifacts).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'data', included: true })]),
      );
    });
  });

  it('returns CONTENT_NOT_EXECUTABLE for markdown tiles', async () => {
    const runDashboardSqlChartQuery = vi.fn();
    const runDashboardChartQuery = vi.fn();
    const handler = registerDashboardTileHandler({
      v2: {
        dashboards: { getDashboard: vi.fn().mockResolvedValue(dashboardFixture) },
        query: { runDashboardSqlChartQuery, runDashboardChartQuery },
      },
    });

    const result = await handler({
      projectUuid: PROJECT,
      dashboardUuidOrSlug: DASHBOARD,
      tileUuid: TILE_MD,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('CONTENT_NOT_EXECUTABLE');
    expect(runDashboardSqlChartQuery).not.toHaveBeenCalled();
    expect(runDashboardChartQuery).not.toHaveBeenCalled();
  });
});

describe('registerRunChart', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
    vi.restoreAllMocks();
  });

  it('returns CONTENT_NOT_EXECUTABLE for standalone SQL charts', async () => {
    const searchContent = vi.fn().mockResolvedValue({
      data: [{ contentType: 'chart', uuid: SAVED_SQL, slug: 'sql-kpi', source: 'sql' }],
    });
    const runChartQuery = vi.fn();
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerRunChart(
      mockServer as never,
      readerContext({
        v2: { content: { searchContent }, query: { runChartQuery } },
      }),
    );
    const [toolName, , handler] = mockServer.registerTool.mock.calls[0];
    expect(toolName).toBe('lightdash_run_chart');

    const result = await (
      handler as (args: Record<string, unknown>) => Promise<{ isError?: boolean }>
    )({
      projectUuid: PROJECT,
      chartUuidOrSlug: SAVED_SQL,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('CONTENT_NOT_EXECUTABLE');
    expect(runChartQuery).not.toHaveBeenCalled();
  });
});
