import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DashboardsClient } from './dashboards';

import type { HttpClient } from '../../http/http-client';

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

  it('getDashboardsAsCode should call GET /projects/{projectUuid}/code/dashboards with no params when no options', async () => {
    const client = new DashboardsClient(mockHttp);
    const results = { offset: 0, total: 1, missingIds: [], dashboards: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.getDashboardsAsCode('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/code/dashboards', undefined);
    expect(result).toEqual(results);
  });

  it('getDashboardsAsCode should call GET with query params when options provided', async () => {
    const client = new DashboardsClient(mockHttp);
    const results = { offset: 0, total: 0, missingIds: [], dashboards: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    await client.getDashboardsAsCode('p1', {
      ids: ['slug-a', 'slug-b'],
      offset: 10,
      languageMap: true,
    });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/code/dashboards', {
      params: { ids: ['slug-a', 'slug-b'], offset: 10, languageMap: true },
    });
  });

  it('upsertDashboardAsCode should call POST /projects/{projectUuid}/code/dashboards/{slug} with body', async () => {
    const client = new DashboardsClient(mockHttp);
    const body = {
      name: 'My Dashboard',
      slug: 'my-dashboard',
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
      spaceSlug: 'my-space',
      tiles: [],
    } as Parameters<DashboardsClient['upsertDashboardAsCode']>[2];
    const apiResult = { promoted: [], errors: [] };
    vi.mocked(mockHttp.post).mockResolvedValue(apiResult);
    const result = await client.upsertDashboardAsCode('p1', 'my-dashboard', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/code/dashboards/my-dashboard', body);
    expect(result).toEqual(apiResult);
  });

  it('upsertDashboardAsCode should encode slug in path', async () => {
    const client = new DashboardsClient(mockHttp);
    const body = {
      name: 'Dashboard',
      slug: 'dash/slug',
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
      spaceSlug: 'space',
      tiles: [],
    } as Parameters<DashboardsClient['upsertDashboardAsCode']>[2];
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.upsertDashboardAsCode('p1', 'dash/slug', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/code/dashboards/dash%2Fslug', body);
  });
});
