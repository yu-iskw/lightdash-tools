import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExploresClient } from './explores';
import type { HttpClient } from '../../http/http-client';

describe('ExploresClient', () => {
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

  it('listExplores should call GET /projects/{projectUuid}/explores', async () => {
    const client = new ExploresClient(mockHttp);
    const explores = [{ name: 'e1', label: 'Explore 1', databaseName: 'db1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(explores);
    const result = await client.listExplores('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/explores');
    expect(result).toEqual(explores);
  });

  it('getExplore should call GET /projects/{projectUuid}/explores/{exploreId}', async () => {
    const client = new ExploresClient(mockHttp);
    const explore = {
      name: 'e1',
      label: 'Explore 1',
      baseTable: 't1',
      joinedTables: [],
    };
    vi.mocked(mockHttp.get).mockResolvedValue(explore);
    const result = await client.getExplore('p1', 'e1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/explores/e1');
    expect(result).toEqual(explore);
  });
});
