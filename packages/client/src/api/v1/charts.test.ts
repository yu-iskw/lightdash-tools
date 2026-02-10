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
});
