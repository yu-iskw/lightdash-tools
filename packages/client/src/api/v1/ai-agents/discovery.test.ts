import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsDiscoveryClient } from './discovery';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsDiscoveryClient', () => {
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

  it('getAgentModelOptions should call GET …/{agentUuid}/models', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const models = [{ name: 'gpt-4', provider: 'openai', default: true }];
    vi.mocked(mockHttp.get).mockResolvedValue(models);
    const result = await client.getAgentModelOptions('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/models');
    expect(result).toEqual(models);
  });

  it('getAgentSuggestions should call GET …/suggestions with optional params', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const suggestions = { chips: [{ label: 'Revenue trend' }] };
    vi.mocked(mockHttp.get).mockResolvedValue(suggestions);
    const result = await client.getAgentSuggestions('proj1', 'a1', {
      threadUuid: 't1',
      enableSqlMode: true,
    });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/suggestions', {
      params: { threadUuid: 't1', enableSqlMode: true },
    });
    expect(result).toEqual(suggestions);
  });

  it('evaluateAgentReadiness should call POST …/evaluateReadiness', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const score = { overallScore: 0.8 };
    vi.mocked(mockHttp.post).mockResolvedValue(score);
    const result = await client.evaluateAgentReadiness('proj1', 'a1');
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluateReadiness', {});
    expect(result).toEqual(score);
  });

  it('getExploreAccessSummary should call POST …/explore-access-summary', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const summary = [{ exploreName: 'orders', metrics: [], dimensions: [], joinedTables: [] }];
    vi.mocked(mockHttp.post).mockResolvedValue(summary);
    const result = await client.getExploreAccessSummary('proj1', { tags: ['ai'] });
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/explore-access-summary', {
      tags: ['ai'],
    });
    expect(result).toEqual(summary);
  });

  it('getExploreAccessSummary without body should default tags to null', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue([]);
    await client.getExploreAccessSummary('proj1');
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/explore-access-summary', {
      tags: null,
    });
  });

  it('getExploreAccessSummary legacy (project, agentUuid, body) ignores agentUuid', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue([]);
    await client.getExploreAccessSummary('proj1', 'a1', { tags: ['ai'] });
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/explore-access-summary', {
      tags: ['ai'],
    });
  });

  it('getExploreAccessSummary legacy (project, agentUuid) defaults tags to null', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue([]);
    await client.getExploreAccessSummary('proj1', 'a1');
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/explore-access-summary', {
      tags: null,
    });
  });

  it('getUserAgentPreferences should call GET …/preferences', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const prefs = { defaultAgentUuid: 'a1' };
    vi.mocked(mockHttp.get).mockResolvedValue(prefs);
    const result = await client.getUserAgentPreferences('proj1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/preferences');
    expect(result).toEqual(prefs);
  });

  it('getUserAgentPreferences should return null when API returns empty success', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    vi.mocked(mockHttp.get).mockResolvedValue(undefined);
    const result = await client.getUserAgentPreferences('proj1');
    expect(result).toBeNull();
  });

  it('setUserAgentPreferences should call POST …/preferences', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    const body = { defaultAgentUuid: 'a2' };
    vi.mocked(mockHttp.post).mockResolvedValue(undefined);
    await client.setUserAgentPreferences('proj1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/preferences', body);
  });

  it('deleteUserAgentPreferences should call DELETE …/preferences', async () => {
    const client = new AiAgentsDiscoveryClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteUserAgentPreferences('proj1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/proj1/aiAgents/preferences');
  });
});
