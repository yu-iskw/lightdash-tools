import { LightdashApiError } from '@lightdash-tools/client';
import { describe, expect, it, vi } from 'vitest';

import { resolveSavedSqlChart } from './resolve-saved-sql-chart.js';

import type { LightdashClient } from '@lightdash-tools/client';

const SAVED = 'ffff6666-aaaa-4bbb-8ccc-dddddddddddd';
const chart = {
  savedSqlUuid: SAVED,
  name: 'SQL KPI',
  slug: 'sql-kpi',
  sql: 'SELECT 1',
  limit: 500,
};

describe('resolveSavedSqlChart', () => {
  it('returns SQL chart by UUID on first GET', async () => {
    const getSavedSqlChart = vi.fn().mockResolvedValue(chart);
    const client = {
      v1: { sqlRunner: { getSavedSqlChart, getSavedSqlChartBySlug: vi.fn() } },
      v2: { content: { searchContent: vi.fn() } },
    } as unknown as LightdashClient;

    await expect(resolveSavedSqlChart(client, 'p1', SAVED)).resolves.toEqual(chart);
    expect(getSavedSqlChart).toHaveBeenCalledWith('p1', SAVED);
  });

  it('falls through to slug only on 404 for UUID GET', async () => {
    const getSavedSqlChart = vi
      .fn()
      .mockRejectedValueOnce(
        new LightdashApiError(404, { name: 'NotFound', statusCode: 404, message: 'missing' }, {}),
      );
    const getSavedSqlChartBySlug = vi.fn().mockResolvedValue(chart);
    const client = {
      v1: { sqlRunner: { getSavedSqlChart, getSavedSqlChartBySlug } },
      v2: { content: { searchContent: vi.fn() } },
    } as unknown as LightdashClient;

    await expect(resolveSavedSqlChart(client, 'p1', SAVED)).resolves.toEqual(chart);
    expect(getSavedSqlChartBySlug).toHaveBeenCalledWith('p1', SAVED);
  });

  it('rethrows non-404 errors from UUID GET', async () => {
    const getSavedSqlChart = vi
      .fn()
      .mockRejectedValue(
        new LightdashApiError(503, { name: 'Unavailable', statusCode: 503, message: 'down' }, {}),
      );
    const getSavedSqlChartBySlug = vi.fn();
    const client = {
      v1: { sqlRunner: { getSavedSqlChart, getSavedSqlChartBySlug } },
      v2: { content: { searchContent: vi.fn() } },
    } as unknown as LightdashClient;

    await expect(resolveSavedSqlChart(client, 'p1', SAVED)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(getSavedSqlChartBySlug).not.toHaveBeenCalled();
  });
});
