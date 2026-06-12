import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsMcpServersClient } from './mcp-servers';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsMcpServersClient', () => {
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

  it('listProjectMcpServers should call GET …/mcpServers', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const servers = [{ uuid: 'mcp1', name: 'GitHub' }];
    vi.mocked(mockHttp.get).mockResolvedValue(servers);
    const result = await client.listProjectMcpServers('proj1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/mcpServers');
    expect(result).toEqual(servers);
  });

  it('createProjectMcpServer should call POST …/mcpServers', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const body = { name: 'Custom', url: 'https://mcp.example.com', authType: 'none' as const };
    const created = { uuid: 'mcp2', ...body };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const result = await client.createProjectMcpServer('proj1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/mcpServers', body);
    expect(result).toEqual(created);
  });

  it('listMcpServerTools should call GET …/mcpServers/{mcpServerUuid}/tools', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const tools = [{ uuid: 'tool1', toolName: 'search' }];
    vi.mocked(mockHttp.get).mockResolvedValue(tools);
    const result = await client.listMcpServerTools('proj1', 'mcp1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/mcpServers/mcp1/tools');
    expect(result).toEqual(tools);
  });

  it('refreshMcpServerTools should call POST …/tools/refresh', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const tools = [{ uuid: 'tool1', toolName: 'search' }];
    vi.mocked(mockHttp.post).mockResolvedValue(tools);
    const result = await client.refreshMcpServerTools('proj1', 'mcp1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/mcpServers/mcp1/tools/refresh',
      {},
    );
    expect(result).toEqual(tools);
  });

  it('listAgentMcpServers should call GET …/{agentUuid}/mcpServers', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const servers = [{ uuid: 'mcp1', name: 'GitHub' }];
    vi.mocked(mockHttp.get).mockResolvedValue(servers);
    const result = await client.listAgentMcpServers('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/mcpServers');
    expect(result).toEqual(servers);
  });

  it('updateAgentMcpServerTools should call PATCH …/{agentUuid}/mcpServers/{mcpServerUuid}/tools', async () => {
    const client = new AiAgentsMcpServersClient(mockHttp);
    const body = { toolSettings: [{ toolName: 'search', enabled: true }] };
    const tools = [{ uuid: 'tool1', toolName: 'search', enabled: true }];
    vi.mocked(mockHttp.patch).mockResolvedValue(tools);
    const result = await client.updateAgentMcpServerTools('proj1', 'a1', 'mcp1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/mcpServers/mcp1/tools',
      body,
    );
    expect(result).toEqual(tools);
  });
});
