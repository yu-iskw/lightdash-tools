import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsThreadsClient } from './threads';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsThreadsClient extensions', () => {
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

  it('generateThreadTitle should call POST …/generate-title', async () => {
    const client = new AiAgentsThreadsClient(mockHttp);
    const title = { title: 'Revenue analysis' };
    vi.mocked(mockHttp.post).mockResolvedValue(title);
    const result = await client.generateThreadTitle('proj1', 'a1', 't1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/generate-title',
      undefined,
      undefined,
    );
    expect(result).toEqual(title);
  });

  it('cloneThread should call POST …/clone/{promptUuid}', async () => {
    const client = new AiAgentsThreadsClient(mockHttp);
    const thread = { uuid: 't2', title: 'Clone' };
    vi.mocked(mockHttp.post).mockResolvedValue(thread);
    const result = await client.cloneThread('proj1', 'a1', 't1', {
      promptUuid: 'p1',
      createdFrom: 'web_app',
    });
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/clone/p1',
      undefined,
      { params: { createdFrom: 'web_app' } },
    );
    expect(result).toEqual(thread);
  });

  it('cloneThread without body should throw', async () => {
    const client = new AiAgentsThreadsClient(mockHttp);
    await expect(client.cloneThread('proj1', 'a1', 't1')).rejects.toThrow(
      'cloneThread requires body.promptUuid',
    );
  });

  it('passes RequestOptions.retry as the HttpClient retry argument', async () => {
    const client = new AiAgentsThreadsClient(mockHttp);
    vi.mocked(mockHttp.post).mockResolvedValue({ response: 'ok' });
    await client.generateAgentThreadResponse('proj1', 'a1', 't1', {
      timeoutMs: 180_000,
      retry: { maxRetries: 0 },
    });
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/generate',
      undefined,
      { timeout: 180_000 },
      { maxRetries: 0 },
    );
  });
});
