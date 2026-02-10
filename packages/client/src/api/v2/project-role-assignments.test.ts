import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRoleAssignmentsClient } from './project-role-assignments';
import type { HttpClient } from '../../http/http-client';

describe('ProjectRoleAssignmentsClient', () => {
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

  it('listAssignments should call GET /projects/{projectId}/roles/assignments', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    const assignments = [{ roleId: 'r1', roleName: 'Editor' }];
    vi.mocked(mockHttp.get).mockResolvedValue(assignments);
    const result = await client.listAssignments('proj-1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj-1/roles/assignments');
    expect(result).toEqual(assignments);
  });

  it('upsertUserAssignment should call POST .../user/{userId} with body', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    const body = { roleId: 'r1' };
    vi.mocked(mockHttp.post).mockResolvedValue({ roleId: 'r1' });
    await client.upsertUserAssignment('proj-1', 'user-1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj-1/roles/assignments/user/user-1',
      body,
    );
  });

  it('deleteUserAssignment should call DELETE .../user/{userId}', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteUserAssignment('proj-1', 'user-1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/proj-1/roles/assignments/user/user-1');
  });

  it('upsertGroupAssignment should call POST .../group/{groupId} with body', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    const body = { roleId: 'r1' };
    vi.mocked(mockHttp.post).mockResolvedValue({ roleId: 'r1' });
    await client.upsertGroupAssignment('proj-1', 'group-1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj-1/roles/assignments/group/group-1',
      body,
    );
  });

  it('deleteGroupAssignment should call DELETE .../group/{groupId}', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteGroupAssignment('proj-1', 'group-1');
    expect(mockHttp.delete).toHaveBeenCalledWith(
      '/projects/proj-1/roles/assignments/group/group-1',
    );
  });

  it('updateGroupAssignment should call PATCH .../group/{groupId}', async () => {
    const client = new ProjectRoleAssignmentsClient(mockHttp);
    const body = { roleId: 'r2' };
    vi.mocked(mockHttp.patch).mockResolvedValue({ roleId: 'r2' });
    await client.updateGroupAssignment('proj-1', 'group-1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith(
      '/projects/proj-1/roles/assignments/group/group-1',
      body,
    );
  });
});
