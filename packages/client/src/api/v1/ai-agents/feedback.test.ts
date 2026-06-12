import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsFeedbackClient } from './feedback';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsFeedbackClient', () => {
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

  it('updateMessageFeedback should call PATCH …/messages/{messageUuid}/feedback', async () => {
    const client = new AiAgentsFeedbackClient(mockHttp);
    const body = { humanScore: 5, humanFeedback: 'Great answer' };
    vi.mocked(mockHttp.patch).mockResolvedValue(undefined);
    await client.updateMessageFeedback('proj1', 'a1', 't1', 'm1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/messages/m1/feedback',
      body,
    );
  });
});
