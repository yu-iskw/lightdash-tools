import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from './query';
import type { HttpClient } from '../../http/http-client';
import type { MetricQueryRequest } from '@lightdash-ai/common';

describe('QueryClient', () => {
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

  it('runQuery should call POST /projects/{projectUuid}/explores/{exploreId}/runQuery with body', async () => {
    const client = new QueryClient(mockHttp);
    const body = { dimensions: [], metrics: [], filters: {} } as unknown as MetricQueryRequest;
    const results = { rows: [], metricQuery: {} };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runQuery('p1', 'explore1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/explores/explore1/runQuery', body);
    expect(result).toEqual(results);
  });
});
