/**
 * V2 parameters client unit tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ParametersClientV2 } from './parameters';

import type { HttpClient } from '../../http/http-client';

describe('ParametersClientV2', () => {
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

  it('listParameters calls GET /projects/{projectUuid}/parameters/list', async () => {
    const client = new ParametersClientV2(mockHttp);
    const mockResponse = { data: [], pagination: {} };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listParameters('p1', { search: 'region', page: 1 });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/parameters/list', {
      params: { search: 'region', page: 1 },
    });
    expect(result).toEqual(mockResponse);
  });

  it('getParameters calls GET /projects/{projectUuid}/parameters', async () => {
    const client = new ParametersClientV2(mockHttp);
    const mockResponse = { region: { type: 'string' } };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getParameters('p1', ['region']);
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/parameters', {
      params: { names: ['region'] },
    });
    expect(result).toEqual(mockResponse);
  });
});
