import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationRolesClient } from './organization-roles';
import type { HttpClient } from '../../http/http-client';

describe('OrganizationRolesClient', () => {
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

  it('getRoles should call GET /orgs/{orgUuid}/roles with optional params', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const results = [{ roleUuid: 'r1', name: 'Role 1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.getRoles('org-1');
    expect(mockHttp.get).toHaveBeenCalledWith('/orgs/org-1/roles', {
      params: undefined,
    });
    expect(result).toEqual(results);
  });

  it('getRoles with params should pass query params', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue([]);
    await client.getRoles('org-1', { load: 'scopes', roleTypeFilter: 'custom' });
    expect(mockHttp.get).toHaveBeenCalledWith('/orgs/org-1/roles', {
      params: { load: 'scopes', roleTypeFilter: 'custom' },
    });
  });

  it('createRole should call POST /orgs/{orgUuid}/roles with body', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const body = { name: 'Editor', description: 'Can edit' };
    const role = { roleUuid: 'r1', name: 'Editor' };
    vi.mocked(mockHttp.post).mockResolvedValue(role);
    const result = await client.createRole('org-1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/orgs/org-1/roles', body);
    expect(result).toEqual(role);
  });

  it('getRole should call GET /orgs/{orgUuid}/roles/{roleUuid}', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const role = { roleUuid: 'r1', name: 'Editor', scopes: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(role);
    const result = await client.getRole('org-1', 'r1');
    expect(mockHttp.get).toHaveBeenCalledWith('/orgs/org-1/roles/r1');
    expect(result).toEqual(role);
  });

  it('updateRole should call PATCH /orgs/{orgUuid}/roles/{roleUuid}', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const body = { name: 'Updated' };
    vi.mocked(mockHttp.patch).mockResolvedValue({ roleUuid: 'r1', name: 'Updated' });
    await client.updateRole('org-1', 'r1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/orgs/org-1/roles/r1', body);
  });

  it('deleteRole should call DELETE /orgs/{orgUuid}/roles/{roleUuid}', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteRole('org-1', 'r1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/orgs/org-1/roles/r1');
  });

  it('addScopesToRole should call POST .../scopes with body', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const body = { scopeNames: ['project:read'] };
    vi.mocked(mockHttp.post).mockResolvedValue(undefined);
    await client.addScopesToRole('org-1', 'r1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/orgs/org-1/roles/r1/scopes', body);
  });

  it('removeScopeFromRole should call DELETE .../scopes/{scopeName}', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.removeScopeFromRole('org-1', 'r1', 'project:read');
    expect(mockHttp.delete).toHaveBeenCalledWith('/orgs/org-1/roles/r1/scopes/project%3Aread');
  });

  it('duplicateRole should call POST .../duplicate with body', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const body = { name: 'Copy of Role' };
    vi.mocked(mockHttp.post).mockResolvedValue({
      roleUuid: 'r2',
      name: 'Copy of Role',
      scopes: [],
    });
    await client.duplicateRole('org-1', 'r1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/orgs/org-1/roles/r1/duplicate', body);
  });

  it('listRoleAssignments should call GET /orgs/{orgUuid}/roles/assignments', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const assignments = [{ roleId: 'r1', roleName: 'Admin' }];
    vi.mocked(mockHttp.get).mockResolvedValue(assignments);
    const result = await client.listRoleAssignments('org-1');
    expect(mockHttp.get).toHaveBeenCalledWith('/orgs/org-1/roles/assignments');
    expect(result).toEqual(assignments);
  });

  it('assignRoleToUser should call POST .../assignments/user/{userId}', async () => {
    const client = new OrganizationRolesClient(mockHttp);
    const body = { roleId: 'r1' };
    vi.mocked(mockHttp.post).mockResolvedValue({ roleId: 'r1' });
    await client.assignRoleToUser('org-1', 'user-1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/orgs/org-1/roles/assignments/user/user-1', body);
  });
});
