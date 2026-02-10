import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectAccessClient } from './project-access';
import type { HttpClient } from '../http/http-client';

describe('ProjectAccessClient', () => {
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

  it('listProjectAccess should call GET /projects/{projectUuid}/access', async () => {
    const client = new ProjectAccessClient(mockHttp);
    const list = [
      {
        userUuid: 'u1',
        email: 'u@example.com',
        firstName: 'U',
        lastName: 'Ser',
        role: 'editor',
        projectUuid: 'p1',
      },
    ];
    vi.mocked(mockHttp.get).mockResolvedValue(list);
    const result = await client.listProjectAccess('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/access');
    expect(result).toEqual(list);
  });

  it('grantProjectAccessToUser should call POST /projects/{projectUuid}/access with body', async () => {
    const client = new ProjectAccessClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue(undefined);
    const body = { email: 'u@example.com', role: 'viewer' as const, sendEmail: true };
    await client.grantProjectAccessToUser('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/access', body);
  });

  it('getProjectMemberAccess should call GET /projects/{projectUuid}/user/{userUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    const member = {
      userUuid: 'u1',
      email: 'u@example.com',
      firstName: 'U',
      lastName: 'Ser',
      role: 'editor',
      projectUuid: 'p1',
    };
    vi.mocked(mockHttp.get).mockResolvedValue(member);
    const result = await client.getProjectMemberAccess('p1', 'u1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/user/u1');
    expect(result).toEqual(member);
  });

  it('updateProjectAccessForUser should call PATCH /projects/{projectUuid}/access/{userUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    vi.mocked(mockHttp.patch).mockResolvedValue(undefined);
    const body = { role: 'editor' as const };
    await client.updateProjectAccessForUser('p1', 'u1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/p1/access/u1', body);
  });

  it('revokeProjectAccessForUser should call DELETE /projects/{projectUuid}/access/{userUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.revokeProjectAccessForUser('p1', 'u1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/access/u1');
  });

  it('listProjectGroupAccesses should call GET /projects/{projectUuid}/groupAccesses', async () => {
    const client = new ProjectAccessClient(mockHttp);
    const list = [{ groupUuid: 'g1', projectUuid: 'p1', role: 'viewer' }];
    vi.mocked(mockHttp.get).mockResolvedValue(list);
    const result = await client.listProjectGroupAccesses('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/groupAccesses');
    expect(result).toEqual(list);
  });

  it('addProjectAccessToGroup should call POST /groups/{groupUuid}/projects/{projectUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    const created = { groupUuid: 'g1', projectUuid: 'p1', role: 'viewer' };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const body = { role: 'viewer' };
    const result = await client.addProjectAccessToGroup('g1', 'p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/groups/g1/projects/p1', body);
    expect(result).toEqual(created);
  });

  it('removeProjectAccessFromGroup should call DELETE /groups/{groupUuid}/projects/{projectUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.removeProjectAccessFromGroup('g1', 'p1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/groups/g1/projects/p1');
  });

  it('updateProjectAccessForGroup should call PATCH /groups/{groupUuid}/projects/{projectUuid}', async () => {
    const client = new ProjectAccessClient(mockHttp);
    const updated = { groupUuid: 'g1', projectUuid: 'p1', role: 'editor' };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const body = { role: 'editor' as const };
    const result = await client.updateProjectAccessForGroup('g1', 'p1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/groups/g1/projects/p1', body);
    expect(result).toEqual(updated);
  });
});
