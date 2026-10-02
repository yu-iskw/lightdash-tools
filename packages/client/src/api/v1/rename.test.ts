import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RenameClient } from './rename';

import type { HttpClient } from '../../http/http-client';

describe('RenameClient', () => {
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

  it('listChartFields should call GET /projects/{projectUuid}/rename/chart/{chartUuid}/fields', async () => {
    const client = new RenameClient(mockHttp);
    const mockResponse = { fields: { orders: ['orders_status'] } };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listChartFields('p1', 'c1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/rename/chart/c1/fields');
    expect(result).toEqual(mockResponse);
  });

  it('listDashboardFields should call GET with a table query when table is set', async () => {
    const client = new RenameClient(mockHttp);
    const mockResponse = { fields: { orders: ['orders_status'] } };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listDashboardFields('p1', 'd1', 'orders');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/rename/dashboard/d1/fields', {
      params: { table: 'orders' },
    });
    expect(result).toEqual(mockResponse);
  });

  it('previewRename should POST /projects/{projectUuid}/rename/preview', async () => {
    const client = new RenameClient(mockHttp);
    const body = { type: 'field' as const, from: 'old', to: 'new', dryRun: true };
    const mockResponse = { charts: [], dashboards: [], alerts: [], dashboardSchedulers: [] };
    vi.mocked(mockHttp.post).mockResolvedValue(mockResponse);
    const result = await client.previewRename('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/rename/preview', body);
    expect(result).toEqual(mockResponse);
  });

  it('renameChart should POST the chart path and return a body without jobId', async () => {
    const client = new RenameClient(mockHttp);
    const body = { type: 'field' as const, from: 'orders_old', to: 'orders_new' };
    const mockResponse = {};
    vi.mocked(mockHttp.post).mockResolvedValue(mockResponse);
    const result = await client.renameChart('p1', 'c1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/rename/chart/c1', body);
    expect(result).toEqual(mockResponse);
    expect(result).not.toHaveProperty('jobId');
  });

  it('renameDashboardFilter should POST /projects/{projectUuid}/rename/dashboard/{dashboardUuid}', async () => {
    const client = new RenameClient(mockHttp);
    const body = { type: 'field' as const, from: 'orders_old', to: 'orders_new' };
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.renameDashboardFilter('p1', 'd1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/rename/dashboard/d1', body);
  });

  it('renameResources should POST /projects/{projectUuid}/rename and return jobId', async () => {
    const client = new RenameClient(mockHttp);
    const body = { type: 'field' as const, from: 'old', to: 'new' };
    vi.mocked(mockHttp.post).mockResolvedValue({ jobId: 'job-1' });
    const result = await client.renameResources('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/rename', body);
    expect(result).toEqual({ jobId: 'job-1' });
  });

  it('posts from and to unchanged when they are equal', async () => {
    const client = new RenameClient(mockHttp);
    const body = { type: 'field' as const, from: 'orders_status', to: 'orders_status' };
    vi.mocked(mockHttp.post).mockResolvedValue({});
    await client.renameChart('p1', 'c1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/rename/chart/c1', body);
  });
});
