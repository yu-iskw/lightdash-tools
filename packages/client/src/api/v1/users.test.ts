import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersClient } from './users';
import type { HttpClient } from '../../http/http-client';

describe('UsersClient', () => {
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

  it('listMembers should call GET /org/users with optional params', async () => {
    const client = new UsersClient(mockHttp);
    const results = { data: [], pagination: { totalResults: 0, totalPageCount: 0 } };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.listMembers({ pageSize: 10, page: 1 });
    expect(mockHttp.get).toHaveBeenCalledWith('/org/users', {
      params: { pageSize: 10, page: 1 },
    });
    expect(result).toEqual(results);
  });

  it('getMemberByUuid should call GET /org/users/{userUuid}', async () => {
    const client = new UsersClient(mockHttp);
    const member = {
      userUuid: 'u1',
      email: 'u@example.com',
      firstName: 'U',
      lastName: 'Ser',
      role: 'editor',
    };
    vi.mocked(mockHttp.get).mockResolvedValue(member);
    const result = await client.getMemberByUuid('u1');
    expect(mockHttp.get).toHaveBeenCalledWith('/org/users/u1');
    expect(result).toEqual(member);
  });

  it('getMemberByEmail should call GET /org/users/email/{encodedEmail}', async () => {
    const client = new UsersClient(mockHttp);
    const member = {
      userUuid: 'u1',
      email: 'user+test@example.com',
      firstName: 'U',
      lastName: 'Ser',
      role: 'editor',
    };
    vi.mocked(mockHttp.get).mockResolvedValue(member);
    const result = await client.getMemberByEmail('user+test@example.com');
    expect(mockHttp.get).toHaveBeenCalledWith('/org/users/email/user%2Btest%40example.com');
    expect(result).toEqual(member);
  });

  it('updateMember should call PATCH /org/users/{userUuid} with body', async () => {
    const client = new UsersClient(mockHttp);
    const body = { role: 'admin' as const };
    const updated = {
      userUuid: 'u1',
      email: 'u@example.com',
      firstName: 'U',
      lastName: 'Ser',
      role: 'admin',
    };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateMember('u1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/org/users/u1', body);
    expect(result).toEqual(updated);
  });

  it('deleteMember should call DELETE /org/user/{userUuid}', async () => {
    const client = new UsersClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteMember('u1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/org/user/u1');
  });

  it('listAllMembers should fetch all pages and return concatenated array', async () => {
    const client = new UsersClient(mockHttp);
    const page1 = {
      data: [
        { userUuid: 'u1', email: 'a@example.com', firstName: 'A', lastName: 'One', role: 'editor' },
      ],
      pagination: { page: 1, pageSize: 1, totalResults: 2, totalPageCount: 2 },
    };
    const page2 = {
      data: [
        { userUuid: 'u2', email: 'b@example.com', firstName: 'B', lastName: 'Two', role: 'viewer' },
      ],
      pagination: { page: 2, pageSize: 1, totalResults: 2, totalPageCount: 2 },
    };
    vi.mocked(mockHttp.get).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await client.listAllMembers(undefined, { pageSize: 1 });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ userUuid: 'u1', email: 'a@example.com' });
    expect(result[1]).toMatchObject({ userUuid: 'u2', email: 'b@example.com' });
    expect(mockHttp.get).toHaveBeenCalledTimes(2);
    expect(mockHttp.get).toHaveBeenNthCalledWith(1, '/org/users', {
      params: { page: 1, pageSize: 1 },
    });
    expect(mockHttp.get).toHaveBeenNthCalledWith(2, '/org/users', {
      params: { page: 2, pageSize: 1 },
    });
  });

  it('listAllMembers should pass through list params (e.g. searchQuery)', async () => {
    const client = new UsersClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 100, totalResults: 0, totalPageCount: 1 },
    });

    await client.listAllMembers({ searchQuery: 'foo' });

    expect(mockHttp.get).toHaveBeenCalledWith('/org/users', {
      params: { searchQuery: 'foo', page: 1, pageSize: 100 },
    });
  });
});
