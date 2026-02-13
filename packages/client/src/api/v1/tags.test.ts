import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagsClient } from './tags';
import type { HttpClient } from '../../http/http-client';

describe('TagsClient', () => {
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

  it('listTags should call GET /projects/{projectUuid}/tags', async () => {
    const client = new TagsClient(mockHttp);
    const mockResponse = { status: 'ok', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.listTags('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/tags');
    expect(result).toEqual(mockResponse);
  });

  it('getTag should call GET /projects/{projectUuid}/tags/{tagUuid}', async () => {
    const client = new TagsClient(mockHttp);
    const mockResponse = { status: 'ok', results: {} };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getTag('p1', 't1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/tags/t1');
    expect(result).toEqual(mockResponse);
  });
});
