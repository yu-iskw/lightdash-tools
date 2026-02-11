import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartsClient } from './charts';
import type { HttpClient } from '../../http/http-client';

describe('ChartsClient', () => {
  let mockHttp: HttpClient;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as HttpClient;
  });

  it('listCharts should call GET /projects/{projectUuid}/charts', async () => {
    const client = new ChartsClient(mockHttp);
    const charts = [{ uuid: 'c1', name: 'Chart 1', projectUuid: 'p1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(charts);
    const result = await client.listCharts('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/charts');
    expect(result).toEqual(charts);
  });

  it('getChartsAsCode should call GET /projects/{projectUuid}/charts/code with no params when no options', async () => {
    const client = new ChartsClient(mockHttp);
    const results = { offset: 0, total: 1, missingIds: [], charts: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.getChartsAsCode('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/charts/code', undefined);
    expect(result).toEqual(results);
  });

  it('getChartsAsCode should call GET with query params when options provided', async () => {
    const client = new ChartsClient(mockHttp);
    const results = { offset: 0, total: 0, missingIds: [], charts: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    await client.getChartsAsCode('p1', {
      ids: ['slug-a', 'slug-b'],
      offset: 10,
      languageMap: true,
    });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/charts/code', {
      params: { ids: ['slug-a', 'slug-b'], offset: 10, languageMap: true },
    });
  });

  it('upsertChartAsCode should call POST /projects/{projectUuid}/charts/{slug}/code with body', async () => {
    const client = new ChartsClient(mockHttp);
    const body = {
      name: 'My Chart',
      slug: 'my-chart',
      tableName: 'orders',
      metricQuery: {
        dimensions: [],
        metrics: [],
        filters: {},
        exploreName: 'orders',
        sorts: [],
        limit: 500,
        tableCalculations: [],
      },
      tableConfig: { columnOrder: [] },
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
      spaceSlug: 'my-space',
      chartConfig: { type: 'cartesian', config: {} },
    } as Parameters<ChartsClient['upsertChartAsCode']>[2];
    const apiResult = { promoted: [], errors: [] };
    vi.mocked(mockHttp.post).mockResolvedValue(apiResult);
    const result = await client.upsertChartAsCode('p1', 'my-chart', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/charts/my-chart/code', body);
    expect(result).toEqual(apiResult);
  });

  it('upsertChartAsCode should encode slug in path', async () => {
    const client = new ChartsClient(mockHttp);
    const body = {
      name: 'Chart',
      slug: 'chart/slug',
      tableName: 't',
      metricQuery: {
        dimensions: [],
        metrics: [],
        filters: {},
        exploreName: 't',
        sorts: [],
        limit: 500,
        tableCalculations: [],
      },
      tableConfig: { columnOrder: [] },
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
      spaceSlug: 'space',
      chartConfig: {},
    } as Parameters<ChartsClient['upsertChartAsCode']>[2];
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.upsertChartAsCode('p1', 'chart/slug', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/charts/chart%2Fslug/code', body);
  });
});
