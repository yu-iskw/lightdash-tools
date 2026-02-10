import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiAgentsClient } from './ai-agents';
import type { HttpClient } from '../../http/http-client';

describe('AiAgentsClient', () => {
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

  it('getAdminThreads should call GET /aiAgents/admin/threads with optional params', async () => {
    const client = new AiAgentsClient(mockHttp);
    const results = { data: [], pagination: { totalResults: 0, totalPageCount: 0 } };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    const result = await client.getAdminThreads({
      page: 1,
      pageSize: 20,
      sortField: 'createdAt',
      sortDirection: 'desc',
    });
    expect(mockHttp.get).toHaveBeenCalledWith('/aiAgents/admin/threads', {
      params: { page: 1, pageSize: 20, sortField: 'createdAt', sortDirection: 'desc' },
    });
    expect(result).toEqual(results);
  });

  it('getAdminThreads without params should call GET with no params', async () => {
    const client = new AiAgentsClient(mockHttp);
    const results = { data: [], pagination: { totalResults: 0, totalPageCount: 0 } };
    vi.mocked(mockHttp.get).mockResolvedValue(results);
    await client.getAdminThreads();
    expect(mockHttp.get).toHaveBeenCalledWith('/aiAgents/admin/threads', { params: undefined });
  });

  it('listAdminAgents should call GET /aiAgents/admin/agents', async () => {
    const client = new AiAgentsClient(mockHttp);
    const list = [{ uuid: 'a1', name: 'Agent 1', description: null }];
    vi.mocked(mockHttp.get).mockResolvedValue(list);
    const result = await client.listAdminAgents();
    expect(mockHttp.get).toHaveBeenCalledWith('/aiAgents/admin/agents');
    expect(result).toEqual(list);
  });

  it('getAiOrganizationSettings should call GET /aiAgents/admin/settings', async () => {
    const client = new AiAgentsClient(mockHttp);
    const settings = {
      aiAgentsVisible: true,
      organizationUuid: 'org1',
      isTrial: false,
      isCopilotEnabled: false,
    };
    vi.mocked(mockHttp.get).mockResolvedValue(settings);
    const result = await client.getAiOrganizationSettings();
    expect(mockHttp.get).toHaveBeenCalledWith('/aiAgents/admin/settings');
    expect(result).toEqual(settings);
  });

  it('updateAiOrganizationSettings should call PATCH /aiAgents/admin/settings with body', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { aiAgentsVisible: false };
    const updated = { aiAgentsVisible: false, organizationUuid: 'org1' };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateAiOrganizationSettings(body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/aiAgents/admin/settings', body);
    expect(result).toEqual(updated);
  });
});
