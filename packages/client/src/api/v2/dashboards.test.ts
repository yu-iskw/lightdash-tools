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

  it('getDashboard encodes slug in path', async () => {
    const client = new DashboardsClientV2(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue({});
    await client.getDashboard('p1', 'dash/slug');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/dashboards/dash%2Fslug');
  });

  it('updateDashboard calls PATCH /projects/{projectUuid}/dashboards/{id} with body', async () => {
    const client = new DashboardsClientV2(mockHttp);
    const body = { name: 'Renamed' } as Parameters<DashboardsClientV2['updateDashboard']>[2];
    const updated = { uuid: 'd1', name: 'Renamed' };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateDashboard('p1', 'd1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/p1/dashboards/d1', body);
    expect(result).toEqual(updated);
  });

  it('updateDashboard encodes slug in path', async () => {
    const client = new DashboardsClientV2(mockHttp);
    const body = { name: 'Renamed' } as Parameters<DashboardsClientV2['updateDashboard']>[2];
    vi.mocked(mockHttp.patch).mockResolvedValue({});
    await client.updateDashboard('p1', 'dash/slug', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/p1/dashboards/dash%2Fslug', body);
  });

  it('deleteDashboard calls DELETE /projects/{projectUuid}/dashboards/{id}', async () => {
    const client = new DashboardsClientV2(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteDashboard('p1', 'd1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/dashboards/d1');
  });

  it('deleteDashboard encodes slug in path', async () => {
    const client = new DashboardsClientV2(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteDashboard('p1', 'dash/slug');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/dashboards/dash%2Fslug');
  });
});
