import { LightdashApiError } from '@lightdash-tools/client';
import { describe, expect, it, vi } from 'vitest';

import { resolveChartSource, sqlChartMatchFromId } from './chart-source.js';
import { loadSavedChartOrOpaqueSql } from './load-saved-chart.js';

import type { LightdashClient } from '@lightdash-tools/client';

describe('resolveChartSource', () => {
  it('returns sql when search match has source sql', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [
              {
                contentType: 'chart',
                uuid: 'u1',
                slug: 'sql-chart',
                source: 'sql',
              },
            ],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(resolveChartSource(client, 'p1', 'sql-chart')).resolves.toEqual({
      class: 'sql',
      uuid: 'u1',
      slug: 'sql-chart',
      name: undefined,
    });
    expect(client.v2.content.searchContent).toHaveBeenCalledWith({
      projectUuids: ['p1'],
      contentTypes: ['chart'],
      search: 'sql-chart',
      pageSize: 25,
    });
  });

  it('looks up UUIDs with the exact uuids filter, not text search', async () => {
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [
              {
                contentType: 'chart',
                uuid,
                slug: 'metric-chart',
                source: 'dbt_explore',
              },
            ],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(resolveChartSource(client, 'p1', uuid)).resolves.toMatchObject({
      class: 'semantic',
      uuid,
    });
    expect(client.v2.content.searchContent).toHaveBeenCalledWith({
      projectUuids: ['p1'],
      contentTypes: ['chart'],
      uuids: [uuid],
      pageSize: 1,
    });
  });

  it('returns unknown when no exact match', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [{ contentType: 'chart', uuid: 'other', slug: 'other', source: 'sql' }],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(resolveChartSource(client, 'p1', 'missing')).resolves.toEqual({
      class: 'unknown',
    });
  });
});

describe('sqlChartMatchFromId', () => {
  it('uses UUID as savedSqlUuid when the identifier is a UUID', () => {
    expect(sqlChartMatchFromId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual({
      class: 'sql',
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      slug: undefined,
      name: undefined,
    });
  });

  it('uses slug when the identifier is not a UUID', () => {
    expect(sqlChartMatchFromId('daily-cost')).toEqual({
      class: 'sql',
      uuid: undefined,
      slug: 'daily-cost',
      name: undefined,
    });
  });
});

describe('loadSavedChartOrOpaqueSql', () => {
  it('skips getSavedChart when search classifies as sql', async () => {
    const getSavedChart = vi.fn();
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [
              {
                contentType: 'chart',
                uuid: 'sql-1',
                slug: 'cost',
                name: 'Cost',
                source: 'sql',
              },
            ],
          }),
        },
        charts: { getSavedChart },
      },
    } as unknown as LightdashClient;

    await expect(
      loadSavedChartOrOpaqueSql(client, 'p1', 'cost', { notFoundAsSql: true }),
    ).resolves.toEqual({
      kind: 'sql',
      match: { class: 'sql', uuid: 'sql-1', slug: 'cost', name: 'Cost' },
    });
    expect(getSavedChart).not.toHaveBeenCalled();
  });

  it('treats semantic GET 404 as opaque SQL', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({ data: [] }),
        },
        charts: {
          getSavedChart: vi
            .fn()
            .mockRejectedValue(
              new LightdashApiError(
                404,
                { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
                {},
              ),
            ),
        },
      },
    } as unknown as LightdashClient;

    await expect(
      loadSavedChartOrOpaqueSql(client, 'p1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        notFoundAsSql: true,
      }),
    ).resolves.toEqual({
      kind: 'sql',
      match: {
        class: 'sql',
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        slug: undefined,
        name: undefined,
      },
    });
  });

  it('rethrows GET 404 when notFoundAsSql is false', async () => {
    const missing = new LightdashApiError(
      404,
      { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
      {},
    );
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({ data: [] }),
        },
        charts: { getSavedChart: vi.fn().mockRejectedValue(missing) },
      },
    } as unknown as LightdashClient;

    await expect(
      loadSavedChartOrOpaqueSql(client, 'p1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        notFoundAsSql: false,
      }),
    ).rejects.toBe(missing);
  });

  it('returns the saved chart when semantic GET succeeds', async () => {
    const chart = { uuid: 'c1', name: 'DAU', metricQuery: {} };
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({ data: [] }),
        },
        charts: { getSavedChart: vi.fn().mockResolvedValue(chart) },
      },
    } as unknown as LightdashClient;

    await expect(
      loadSavedChartOrOpaqueSql(client, 'p1', 'c1', { notFoundAsSql: true }),
    ).resolves.toEqual({
      kind: 'semantic',
      chart,
    });
  });
});
