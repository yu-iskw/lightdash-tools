/**
 * V2 charts client unit tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartsClientV2 } from './charts';

import type { HttpClient } from '../../http/http-client';

describe('ChartsClientV2', () => {
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

  it('getSavedChart calls GET /projects/{projectUuid}/saved/{id}', async () => {
    const client = new ChartsClientV2(mockHttp);
    const mockResponse = { uuid: 'c1', name: 'Revenue' };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getSavedChart('p1', 'c1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/saved/c1');
    expect(result).toEqual(mockResponse);
  });

  it('getSavedChart encodes slug path segments', async () => {
    const client = new ChartsClientV2(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue({ uuid: 'c1' });
    await client.getSavedChart('p1', 'my/chart');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/saved/my%2Fchart');
  });
});
