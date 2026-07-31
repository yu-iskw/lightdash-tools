/**
 * V2 dashboards client unit tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardsClientV2 } from './dashboards';

import type { HttpClient } from '../../http/http-client';

describe('DashboardsClientV2', () => {
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

  it('getDashboard calls GET /projects/{projectUuid}/dashboards/{id}', async () => {
    const client = new DashboardsClientV2(mockHttp);
    const mockResponse = { uuid: 'd1', name: 'Sales' };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getDashboard('p1', 'd1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/dashboards/d1');
    expect(result).toEqual(mockResponse);
  });
});
