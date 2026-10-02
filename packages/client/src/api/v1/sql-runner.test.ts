import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SqlRunnerClient } from './sql-runner.js';

import type { HttpClient } from '../../http/http-client';

describe('SqlRunnerClient', () => {
  let mockHttp: HttpClient;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      getBytes: vi.fn(),
    } as unknown as HttpClient;
  });

  it('getSavedSqlChart should call GET /projects/{projectUuid}/sqlRunner/saved/{uuid}', async () => {
    const client = new SqlRunnerClient(mockHttp);
    const chart = {
      savedSqlUuid: 'sql-1',
      name: 'Orders SQL',
      slug: 'orders-sql',
      sql: 'SELECT 1',
      limit: 500,
    };
    vi.mocked(mockHttp.get).mockResolvedValue(chart);
    const result = await client.getSavedSqlChart('p1', 'sql-1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/sqlRunner/saved/sql-1');
    expect(result).toEqual(chart);
  });

  it('getSavedSqlChartBySlug should call GET …/sqlRunner/saved/slug/{slug}', async () => {
    const client = new SqlRunnerClient(mockHttp);
    const chart = {
      savedSqlUuid: 'sql-1',
      name: 'Orders SQL',
      slug: 'orders-sql',
      sql: 'SELECT 1',
      limit: 500,
    };
    vi.mocked(mockHttp.get).mockResolvedValue(chart);
    const result = await client.getSavedSqlChartBySlug('p1', 'orders-sql');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/sqlRunner/saved/slug/orders-sql');
    expect(result).toEqual(chart);
  });

  it('encodes uuid and slug path segments', async () => {
    const client = new SqlRunnerClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue({});
    await client.getSavedSqlChart('p1', 'a/b');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/sqlRunner/saved/a%2Fb');
    await client.getSavedSqlChartBySlug('p1', 'slug/with spaces');
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/projects/p1/sqlRunner/saved/slug/slug%2Fwith%20spaces',
    );
  });
});
