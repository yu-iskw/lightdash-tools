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

  it('createDashboard should call POST /projects/{projectUuid}/dashboards with body and no params by default', async () => {
    const client = new DashboardsClient(mockHttp);
    const body = { name: 'New Dashboard', tiles: [], tabs: [] } as Parameters<
      DashboardsClient['createDashboard']
    >[1];
    const created = { uuid: 'd1', name: 'New Dashboard', projectUuid: 'p1' };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const result = await client.createDashboard('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/dashboards', body, undefined);
    expect(result).toEqual(created);
  });

  it('createDashboard should call POST with duplicateFrom query param when provided', async () => {
    const client = new DashboardsClient(mockHttp);
    const body = { dashboardDesc: 'Copy', dashboardName: 'Copy of Dashboard' } as Parameters<
      DashboardsClient['createDashboard']
    >[1];
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.createDashboard('p1', body, { duplicateFrom: 'd0' });
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/dashboards', body, {
      params: { duplicateFrom: 'd0' },
    });
  });

  it('getDashboardHistory should call GET /dashboards/{dashboardUuidOrSlug}/history', async () => {
    const client = new DashboardsClient(mockHttp);
    const history = { dashboardUuid: 'd1', history: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(history);
    const result = await client.getDashboardHistory('d1');
    expect(mockHttp.get).toHaveBeenCalledWith('/dashboards/d1/history');
    expect(result).toEqual(history);
  });

  it('getDashboardHistory should encode slug in path', async () => {
    const client = new DashboardsClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue({});
    await client.getDashboardHistory('dash/slug');
    expect(mockHttp.get).toHaveBeenCalledWith('/dashboards/dash%2Fslug/history');
  });

  it('getDashboardVersion should call GET /dashboards/{dashboardUuidOrSlug}/version/{versionUuid}', async () => {
    const client = new DashboardsClient(mockHttp);
    const version = { dashboardUuid: 'd1', versionUuid: 'v1' };
    vi.mocked(mockHttp.get).mockResolvedValue(version);
    const result = await client.getDashboardVersion('d1', 'v1');
    expect(mockHttp.get).toHaveBeenCalledWith('/dashboards/d1/version/v1');
    expect(result).toEqual(version);
  });

  it('getDashboardPromoteDiff should call GET /dashboards/{id}/promoteDiff', async () => {
    const client = new DashboardsClient(mockHttp);
    const diff = { charts: [], dashboards: [], spaces: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(diff);
    const result = await client.getDashboardPromoteDiff('d1');
    expect(mockHttp.get).toHaveBeenCalledWith('/dashboards/d1/promoteDiff', undefined);
    expect(result).toEqual(diff);
  });

  it('getDashboardPromoteDiff should pass projectUuid query and encode slug', async () => {
    const client = new DashboardsClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue({ charts: [], dashboards: [], spaces: [] });
    await client.getDashboardPromoteDiff('dash/slug', { projectUuid: 'p1' });
    expect(mockHttp.get).toHaveBeenCalledWith('/dashboards/dash%2Fslug/promoteDiff', {
      params: { projectUuid: 'p1' },
    });
  });

  it('promoteDashboard should call POST /dashboards/{id}/promote', async () => {
    const client = new DashboardsClient(mockHttp);
    const promoted = { uuid: 'd1', name: 'Board', projectUuid: 'upstream' };
    vi.mocked(mockHttp.post).mockResolvedValue(promoted);
    const result = await client.promoteDashboard('d1');
    expect(mockHttp.post).toHaveBeenCalledWith('/dashboards/d1/promote', undefined, undefined);
    expect(result).toEqual(promoted);
  });

  it('promoteDashboard should pass projectUuid query and encode slug', async () => {
    const client = new DashboardsClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.promoteDashboard('dash/slug', { projectUuid: 'p1' });
    expect(mockHttp.post).toHaveBeenCalledWith('/dashboards/dash%2Fslug/promote', undefined, {
      params: { projectUuid: 'p1' },
    });
  });
});
