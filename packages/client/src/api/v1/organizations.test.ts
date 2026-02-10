import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationsClient } from './organizations';
import type { HttpClient } from '../../http/http-client';

describe('OrganizationsClient', () => {
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

  it('getCurrentOrganization should call GET /org', async () => {
    const client = new OrganizationsClient(mockHttp);
    const org = { organizationUuid: 'o1', name: 'My Org' };
    vi.mocked(mockHttp.get).mockResolvedValue(org);
    const result = await client.getCurrentOrganization();
    expect(mockHttp.get).toHaveBeenCalledWith('/org');
    expect(result).toEqual(org);
  });
});
