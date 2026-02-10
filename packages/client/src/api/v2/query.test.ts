import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClientV2 } from './query';
import type { HttpClient } from '../../http/http-client';
import type {
  ExecuteAsyncMetricQueryRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncUnderlyingDataRequestParams,
} from '@lightdash-ai/common';

describe('QueryClientV2', () => {
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

  it('runMetricQuery should call POST /projects/{projectUuid}/query/metric-query with body', async () => {
    const client = new QueryClientV2(mockHttp);
    const body = {
      exploreName: 'e1',
      metricQuery: {},
    } as unknown as ExecuteAsyncMetricQueryRequestParams;
    const results = { queryId: 'q1', status: 'running' };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runMetricQuery('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/query/metric-query', body);
    expect(result).toEqual(results);
  });

  it('runSqlQuery should call POST /projects/{projectUuid}/query/sql with body', async () => {
    const client = new QueryClientV2(mockHttp);
    const body = { sql: 'SELECT 1' };
    const results = { queryId: 'q1', status: 'running' };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runSqlQuery('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/query/sql', body);
    expect(result).toEqual(results);
  });

  it('runChartQuery should call POST /projects/{projectUuid}/query/chart with body', async () => {
    const client = new QueryClientV2(mockHttp);
    const body = { chartUuid: 'c1' } as unknown as ExecuteAsyncSavedChartRequestParams;
    const results = { queryId: 'q1', status: 'running' };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runChartQuery('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/query/chart', body);
    expect(result).toEqual(results);
  });

  it('runDashboardChartQuery should call POST /projects/{projectUuid}/query/dashboard-chart with body', async () => {
    const client = new QueryClientV2(mockHttp);
    const body = {
      dashboardChartUuid: 'dc1',
    } as unknown as ExecuteAsyncDashboardChartRequestParams;
    const results = { queryId: 'q1', status: 'running' };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runDashboardChartQuery('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/query/dashboard-chart', body);
    expect(result).toEqual(results);
  });

  it('runUnderlyingDataQuery should call POST /projects/{projectUuid}/query/underlying-data with body', async () => {
    const client = new QueryClientV2(mockHttp);
    const body = {
      exploreName: 'e1',
      metricQuery: {},
    } as unknown as ExecuteAsyncUnderlyingDataRequestParams;
    const results = { queryId: 'q1', status: 'running' };
    vi.mocked(mockHttp.post).mockResolvedValue(results);
    const result = await client.runUnderlyingDataQuery('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/query/underlying-data', body);
    expect(result).toEqual(results);
  });
});
