import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardsClient } from './dashboards';
import type { HttpClient } from '../http/http-client';

describe('DashboardsClient', () => {
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

  it('listDashboards should call GET /projects/{projectUuid}/dashboards', async () => {
    const client = new DashboardsClient(mockHttp);
    const dashboards = [{ uuid: 'd1', name: 'Dashboard 1', projectUuid: 'p1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(dashboards);
    const result = await client.listDashboards('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/dashboards');
    expect(result).toEqual(dashboards);
  });
});
