/**
 * get_chart SQL reveal + summary helpers (ADR-0032).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';

import { registerGetChart, toReaderSqlChartSummary } from './reader-content.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { SqlChart } from '@lightdash-tools/client';

const PROJECT = '550e8400-e29b-41d4-a716-446655440000';
const SAVED_SQL = 'ffff6666-aaaa-4bbb-8ccc-dddddddddddd';

function readerContext(lightdashClient: unknown): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient,
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

describe('toReaderSqlChartSummary', () => {
  it('omits authored sql from the summary', () => {
    const chart = {
      savedSqlUuid: SAVED_SQL,
      name: 'SQL KPI',
      slug: 'sql-kpi',
      description: null,
      sql: 'SELECT 1',
      limit: 100,
      chartKind: 'table',
      space: { uuid: 's1', name: 'Space' },
      lastUpdatedAt: '2026-01-01T00:00:00Z',
    } as unknown as SqlChart;
    const summary = toReaderSqlChartSummary(chart);
    expect(summary).not.toHaveProperty('sql');
    expect(summary.savedSqlUuid).toBe(SAVED_SQL);
    expect(summary.executable).toBe(false);
  });
});

describe('registerGetChart SQL reveal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns metadata with SQL_ARTIFACT_AVAILABLE by default', async () => {
    const searchContent = vi.fn().mockResolvedValue({
      data: [
        {
          contentType: 'chart',
          uuid: SAVED_SQL,
          slug: 'sql-kpi',
          source: 'sql',
          name: 'SQL KPI',
          description: null,
          space: { uuid: 's1', name: 'Space' },
          lastUpdatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const getSavedSqlChart = vi.fn();
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerGetChart(
      mockServer as never,
      readerContext({
        v1: { sqlRunner: { getSavedSqlChart } },
        v2: { content: { searchContent } },
      }),
    );
    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await (
      handler as (args: Record<string, unknown>) => Promise<{
        content: Array<{ type?: string; text?: string; resource?: unknown }>;
      }>
    )({
      projectUuid: PROJECT,
      chartUuidOrSlug: SAVED_SQL,
    });

    expect(getSavedSqlChart).not.toHaveBeenCalled();
    const body = JSON.parse(result.content[0].text!) as {
      data: { chartType: string; savedSqlUuid: string; name?: string };
      warnings: Array<{ code: string }>;
      artifacts: Array<{ kind: string; included: boolean }>;
    };
    expect(body.data.chartType).toBe('sql');
    expect(body.data.savedSqlUuid).toBe(SAVED_SQL);
    expect(body.data.name).toBe('SQL KPI');
    expect(JSON.stringify(body)).not.toContain('SELECT metric');
    expect(body.warnings.map((w) => w.code)).toContain('SQL_ARTIFACT_AVAILABLE');
    expect(body.artifacts).toEqual([expect.objectContaining({ kind: 'sql', included: false })]);
    expect(result.content).toHaveLength(1);
  });

  it('attaches SQL resource when includeArtifacts includes sql', async () => {
    const searchContent = vi.fn().mockResolvedValue({
      data: [{ contentType: 'chart', uuid: SAVED_SQL, slug: 'sql-kpi', source: 'sql' }],
    });
    const getSavedSqlChart = vi.fn().mockResolvedValue({
      savedSqlUuid: SAVED_SQL,
      name: 'SQL KPI',
      slug: 'sql-kpi',
      description: null,
      sql: 'SELECT metric FROM kpi',
      limit: 500,
      chartKind: 'table',
      space: { uuid: 's1', name: 'Space' },
      lastUpdatedAt: '2026-01-01T00:00:00Z',
    });
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerGetChart(
      mockServer as never,
      readerContext({
        v1: { sqlRunner: { getSavedSqlChart } },
        v2: { content: { searchContent } },
      }),
    );
    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await (
      handler as (args: Record<string, unknown>) => Promise<{
        content: Array<{ type?: string; text?: string; resource?: { text?: string } }>;
      }>
    )({
      projectUuid: PROJECT,
      chartUuidOrSlug: SAVED_SQL,
      includeArtifacts: ['sql'],
    });

    expect(result.content).toHaveLength(2);
    expect(result.content[1]?.resource?.text).toBe('SELECT metric FROM kpi');
    const body = JSON.parse(result.content[0].text!) as {
      warnings: Array<{ code: string }>;
      artifacts: Array<{ included: boolean }>;
    };
    expect(body.artifacts[0]?.included).toBe(true);
    expect(body.warnings).toEqual([]);
  });
});
