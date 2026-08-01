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

  it('moveContent should call POST /content/{projectUuid}/move with body', async () => {
    const client = new ContentClient(mockHttp);
    const body = {
      action: { type: 'move' as const, targetSpaceUuid: 's2' },
      item: { source: 'dbt_explore' as const, contentType: 'chart' as const, uuid: 'c1' },
    } as Parameters<ContentClient['moveContent']>[1];
    vi.mocked(mockHttp.post).mockResolvedValue({ status: 'ok' });
    await client.moveContent('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/content/p1/move', body);
  });

  it('bulkMoveContent should call POST /content/bulk-action/{projectUuid}/move with body', async () => {
    const client = new ContentClient(mockHttp);
    const body = {
      action: { type: 'move' as const, targetSpaceUuid: 's2' },
      content: [{ source: 'dbt_explore' as const, contentType: 'chart' as const, uuid: 'c1' }],
    } as Parameters<ContentClient['bulkMoveContent']>[1];
    vi.mocked(mockHttp.post).mockResolvedValue({ status: 'ok' });
    await client.bulkMoveContent('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/content/bulk-action/p1/move', body);
  });

  it('permanentlyDeleteContent should call DELETE /content/{projectUuid}/permanent with body', async () => {
    const client = new ContentClient(mockHttp);
    const body = {
      item: { contentType: 'chart' as const, uuid: 'c1', source: 'dbt_explore' as const },
    } as Parameters<ContentClient['permanentlyDeleteContent']>[1];
    vi.mocked(mockHttp.delete).mockResolvedValue({ status: 'ok' });
    await client.permanentlyDeleteContent('p1', body);
    expect(mockHttp.delete).toHaveBeenCalledWith('/content/p1/permanent', { data: body });
  });
});
