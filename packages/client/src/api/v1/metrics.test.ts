import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsClient } from './metrics';
import type { HttpClient } from '../../http/http-client';

describe('MetricsClient', () => {
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

  it('listMetrics should call GET /projects/{projectUuid}/dataCatalog/metrics', async () => {
    const client = new MetricsClient(mockHttp);
    const mockResponse = { status: 'ok', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listMetrics('p1', { search: 'test' });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/dataCatalog/metrics', {
      params: { search: 'test' },
    });
    expect(result).toEqual(mockResponse);
  });

  it('getMetric should call GET /projects/{projectUuid}/dataCatalog/metrics/{tableName}/{metricName}', async () => {
    const client = new MetricsClient(mockHttp);
    const mockResponse = { status: 'ok', results: {} };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getMetric('p1', 't1', 'm1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/dataCatalog/metrics/t1/m1');
    expect(result).toEqual(mockResponse);
  });
});
