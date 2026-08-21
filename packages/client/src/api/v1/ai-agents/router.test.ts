import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsRouterClient } from './router';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsRouterClient', () => {
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

  it('routeAiAgent should call POST /org/aiRouter/route', async () => {
    const client = new AiAgentsRouterClient(mockHttp);
    const result = {
      nextAction: 'create_thread' as const,
      decision: {
        candidates: [{ agentUuid: 'a1', name: 'Basic', description: null }],
        reasoning: 'best fit',
        confidence: 'high' as const,
        suggestedAgentUuid: 'a1',
        decisionUuid: 'd1',
      },
    };
    vi.mocked(mockHttp.post).mockResolvedValue(result);
    const body = { projectUuid: 'proj1', prompt: 'What is revenue?' };
    const got = await client.routeAiAgent(body);
    expect(mockHttp.post).toHaveBeenCalledWith('/org/aiRouter/route', body, undefined, {
      maxRetries: 0,
    });
    expect(got).toEqual(result);
  });
});
