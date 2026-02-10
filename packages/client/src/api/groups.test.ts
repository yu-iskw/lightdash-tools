import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupsClient } from './groups';
import type { HttpClient } from '../http/http-client';

describe('GroupsClient', () => {
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

  it('listGroups should call GET /org/groups with optional params', async () => {
    const client = new GroupsClient(mockHttp);
    const results = { data: [], pagination: { totalResults: 0, totalPageCount: 0 } };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.listGroups({ pageSize: 10 });
    expect(mockHttp.get).toHaveBeenCalledWith('/org/groups', {
      params: { pageSize: 10 },
    });
    expect(result).toEqual(results);
  });

  it('createGroup should call POST /org/groups with body', async () => {
    const client = new GroupsClient(mockHttp);
    const group = {
      name: 'Admins',
      groupUuid: 'g1',
      organizationUuid: 'o1',
      memberUuids: [],
      members: [],
    };
    vi.mocked(mockHttp.post).mockResolvedValue(group);
    const result = await client.createGroup({ name: 'Admins' });
    expect(mockHttp.post).toHaveBeenCalledWith('/org/groups', { name: 'Admins' });
    expect(result).toEqual(group);
  });

  it('getGroupMembers should call GET /groups/{groupUuid}/members', async () => {
    const client = new GroupsClient(mockHttp);
    const members = [{ userUuid: 'u1', email: 'u@example.com', firstName: 'U', lastName: 'Ser' }];
    vi.mocked(mockHttp.get).mockResolvedValue(members);
    const result = await client.getGroupMembers('g1');
    expect(mockHttp.get).toHaveBeenCalledWith('/groups/g1/members');
    expect(result).toEqual(members);
  });
});
