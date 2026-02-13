import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulersClient } from './schedulers';
import type { HttpClient } from '../../http/http-client';

describe('SchedulersClient', () => {
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

  it('listSchedulers should call GET /schedulers/{projectUuid}/list', async () => {
    const client = new SchedulersClient(mockHttp);
    const mockResponse = { status: 'ok', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listSchedulers('p1', { page: 1 });
    expect(mockHttp.get).toHaveBeenCalledWith('/schedulers/p1/list', {
      params: { page: 1 },
    });
    expect(result).toEqual(mockResponse);
  });

  it('getScheduler should call GET /schedulers/{schedulerUuid}', async () => {
    const client = new SchedulersClient(mockHttp);
    const mockResponse = { status: 'ok', results: {} };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getScheduler('s1');
    expect(mockHttp.get).toHaveBeenCalledWith('/schedulers/s1');
    expect(result).toEqual(mockResponse);
  });
});
