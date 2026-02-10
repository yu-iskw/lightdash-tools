import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpacesClient } from './spaces';
import type { HttpClient } from '../../http/http-client';

describe('SpacesClient', () => {
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

  it('listSpacesInProject should call GET /projects/{projectUuid}/spaces', async () => {
    const client = new SpacesClient(mockHttp);
    const spaces = [{ uuid: 's1', name: 'Space 1', projectUuid: 'p1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(spaces);
    const result = await client.listSpacesInProject('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/spaces');
    expect(result).toEqual(spaces);
  });

  it('getSpace should call GET /projects/{projectUuid}/spaces/{spaceUuid}', async () => {
    const client = new SpacesClient(mockHttp);
    const space = { uuid: 's1', name: 'Space 1', projectUuid: 'p1', organizationUuid: 'o1' };
    vi.mocked(mockHttp.get).mockResolvedValue(space);
    const result = await client.getSpace('p1', 's1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/spaces/s1');
    expect(result).toEqual(space);
  });

  it('createSpace should call POST /projects/{projectUuid}/spaces with body', async () => {
    const client = new SpacesClient(mockHttp);
    const created = { uuid: 's1', name: 'New Space', projectUuid: 'p1' };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const body = { name: 'New Space' };
    const result = await client.createSpace('p1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/spaces', body);
    expect(result).toEqual(created);
  });

  it('updateSpace should call PATCH /projects/{projectUuid}/spaces/{spaceUuid} with body', async () => {
    const client = new SpacesClient(mockHttp);
    const updated = { uuid: 's1', name: 'Updated', projectUuid: 'p1' };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const body = { name: 'Updated' };
    const result = await client.updateSpace('p1', 's1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/p1/spaces/s1', body);
    expect(result).toEqual(updated);
  });

  it('deleteSpace should call DELETE /projects/{projectUuid}/spaces/{spaceUuid}', async () => {
    const client = new SpacesClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteSpace('p1', 's1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/spaces/s1');
  });

  it('grantUserAccessToSpace should call POST .../share with body', async () => {
    const client = new SpacesClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue(undefined);
    const body = { userUuid: 'u1', spaceRole: 'editor' as const };
    await client.grantUserAccessToSpace('p1', 's1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/spaces/s1/share', body);
  });

  it('revokeUserAccessToSpace should call DELETE .../share/{userUuid}', async () => {
    const client = new SpacesClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.revokeUserAccessToSpace('p1', 's1', 'u1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/spaces/s1/share/u1');
  });

  it('grantGroupAccessToSpace should call POST .../group/share with body', async () => {
    const client = new SpacesClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue(undefined);
    const body = { groupUuid: 'g1', spaceRole: 'viewer' as const };
    await client.grantGroupAccessToSpace('p1', 's1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/spaces/s1/group/share', body);
  });

  it('revokeGroupAccessToSpace should call DELETE .../group/share/{groupUuid}', async () => {
    const client = new SpacesClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.revokeGroupAccessToSpace('p1', 's1', 'g1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/p1/spaces/s1/group/share/g1');
  });
});
