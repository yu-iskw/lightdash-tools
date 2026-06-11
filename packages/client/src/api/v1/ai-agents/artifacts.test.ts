import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsArtifactsClient } from './artifacts';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsArtifactsClient', () => {
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

  it('listVerifiedArtifacts should call GET …/verified-artifacts with pagination params', async () => {
    const client = new AiAgentsArtifactsClient(mockHttp);
    const paged = { data: [], pagination: { page: 1, pageSize: 10, totalResults: 0, totalPageCount: 0 } };
    vi.mocked(mockHttp.get).mockResolvedValue(paged);
    const result = await client.listVerifiedArtifacts('proj1', 'a1', { page: 1, pageSize: 10 });
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/verified-artifacts',
      { params: { page: 1, pageSize: 10 } },
    );
    expect(result).toEqual(paged);
  });

  it('listVerifiedQuestions should call GET …/verified-questions', async () => {
    const client = new AiAgentsArtifactsClient(mockHttp);
    const questions = [{ uuid: 'q1', question: 'What is revenue?' }];
    vi.mocked(mockHttp.get).mockResolvedValue(questions);
    const result = await client.listVerifiedQuestions('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/verified-questions');
    expect(result).toEqual(questions);
  });

  it('getArtifact should call GET …/artifacts/{artifactUuid}', async () => {
    const client = new AiAgentsArtifactsClient(mockHttp);
    const artifact = { artifactUuid: 'art1', versionUuid: 'v1' };
    vi.mocked(mockHttp.get).mockResolvedValue(artifact);
    const result = await client.getArtifact('proj1', 'a1', 'art1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/artifacts/art1');
    expect(result).toEqual(artifact);
  });

  it('getArtifactVersion should call GET …/artifacts/{artifactUuid}/versions/{versionUuid}', async () => {
    const client = new AiAgentsArtifactsClient(mockHttp);
    const artifact = { artifactUuid: 'art1', versionUuid: 'v2' };
    vi.mocked(mockHttp.get).mockResolvedValue(artifact);
    const result = await client.getArtifactVersion('proj1', 'a1', 'art1', 'v2');
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/artifacts/art1/versions/v2',
    );
    expect(result).toEqual(artifact);
  });

  it('getMessageVizQuery should call GET …/messages/{messageUuid}/viz-query', async () => {
    const client = new AiAgentsArtifactsClient(mockHttp);
    const vizQuery = { type: 'table', metadata: { title: null, description: null } };
    vi.mocked(mockHttp.get).mockResolvedValue(vizQuery);
    const result = await client.getMessageVizQuery('proj1', 'a1', 't1', 'm1');
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/messages/m1/viz-query',
    );
    expect(result).toEqual(vizQuery);
  });
});
