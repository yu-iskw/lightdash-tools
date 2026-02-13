import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentClient } from './content';
import type { HttpClient } from '../../http/http-client';

describe('ContentClient', () => {
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

  it('searchContent should call GET /content', async () => {
    const client = new ContentClient(mockHttp);
    const mockResponse = { status: 'ok', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.searchContent({ search: 'test' });
    expect(mockHttp.get).toHaveBeenCalledWith('/content', {
      params: { search: 'test' },
    });
    expect(result).toEqual(mockResponse);
  });
});
