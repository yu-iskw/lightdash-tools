import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsSqlApprovalClient } from './sql-approval';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsSqlApprovalClient', () => {
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

  it('submitSqlApproval should call POST …/tool-calls/{toolCallId}/sql-approval', async () => {
    const client = new AiAgentsSqlApprovalClient(mockHttp);
    const body = { decision: 'approved' as const };
    const result = { decision: 'approved' as const };
    vi.mocked(mockHttp.post).mockResolvedValue(result);
    const response = await client.submitSqlApproval('proj1', 'a1', 't1', 'call-1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/tool-calls/call-1/sql-approval',
      body,
    );
    expect(response).toEqual(result);
  });
});
