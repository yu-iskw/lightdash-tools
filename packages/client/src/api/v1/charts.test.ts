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
      getBytes: vi.fn(),
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

  it('getChartsAsCode should call GET /projects/{projectUuid}/code/charts with no params when no options', async () => {
    const client = new ChartsClient(mockHttp);
    const results = { offset: 0, total: 1, missingIds: [], charts: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.getChartsAsCode('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/code/charts', undefined);
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
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/code/charts', {
      params: { ids: ['slug-a', 'slug-b'], offset: 10, languageMap: true },
    });
  });

  it('upsertChartAsCode should call POST /projects/{projectUuid}/code/charts/{slug} with body', async () => {
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
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/code/charts/my-chart', body);
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
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/code/charts/chart%2Fslug', body);
  });

  it('getChartHistory should call GET /saved/{chartUuid}/history', async () => {
    const client = new ChartsClient(mockHttp);
    const history = { chartUuid: 'c1', history: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(history);
    const result = await client.getChartHistory('c1');
    expect(mockHttp.get).toHaveBeenCalledWith('/saved/c1/history');
    expect(result).toEqual(history);
  });

  it('getChartVersion should call GET /saved/{chartUuid}/version/{versionUuid}', async () => {
    const client = new ChartsClient(mockHttp);
    const version = { chartUuid: 'c1', versionUuid: 'v1' };
    vi.mocked(mockHttp.get).mockResolvedValue(version);
    const result = await client.getChartVersion('c1', 'v1');
    expect(mockHttp.get).toHaveBeenCalledWith('/saved/c1/version/v1');
    expect(result).toEqual(version);
  });

  it('exportChartImage should POST /saved/{chartUuid}/export and return URL', async () => {
    const client = new ChartsClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue('https://cdn.example/chart.png');
    const result = await client.exportChartImage('c1', 'p1');
    expect(mockHttp.post).toHaveBeenCalledWith('/saved/c1/export', undefined, {
      params: { projectUuid: 'p1' },
      timeout: 120_000,
    });
    expect(result).toBe('https://cdn.example/chart.png');
  });

  it('exportChartImagePng should export then download bytes', async () => {
    const client = new ChartsClient(mockHttp);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(mockHttp.post).mockResolvedValue('https://cdn.example/chart.png');
    vi.mocked(mockHttp.getBytes).mockResolvedValue({ bytes: png, mimeType: 'image/png' });
    const result = await client.exportChartImagePng('c1');
    expect(mockHttp.getBytes).toHaveBeenCalledWith('https://cdn.example/chart.png', {
      maxBytes: 8 * 1024 * 1024,
      timeout: 120_000,
    });
    expect(result).toEqual({
      imageUrl: 'https://cdn.example/chart.png',
      bytes: png,
      mimeType: 'image/png',
    });
  });
});
