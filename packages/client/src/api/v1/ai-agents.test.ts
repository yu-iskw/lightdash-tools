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

  // ─── Admin ───────────────────────────────────────────────────────────────────

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

  // ─── Project-scoped: agent CRUD ──────────────────────────────────────────────

  it('listAgents should call GET /projects/{projectUuid}/aiAgents', async () => {
    const client = new AiAgentsClient(mockHttp);
    const list = [{ uuid: 'a1', name: 'Agent 1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(list);
    const result = await client.listAgents('proj1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents');
    expect(result).toEqual(list);
  });

  it('getAgent should call GET /projects/{projectUuid}/aiAgents/{agentUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    const agent = { uuid: 'a1', name: 'Agent 1', projectUuid: 'proj1' };
    vi.mocked(mockHttp.get).mockResolvedValue(agent);
    const result = await client.getAgent('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1');
    expect(result).toEqual(agent);
  });

  it('createAgent should call POST /projects/{projectUuid}/aiAgents with body', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { name: 'New Agent', projectUuid: 'proj1' } as never;
    const created = { uuid: 'a2', name: 'New Agent', projectUuid: 'proj1' };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const result = await client.createAgent('proj1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents', body);
    expect(result).toEqual(created);
  });

  it('updateAgent should call PATCH /projects/{projectUuid}/aiAgents/{agentUuid} with body', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { name: 'Updated Agent' } as never;
    const updated = { uuid: 'a1', name: 'Updated Agent', projectUuid: 'proj1' };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateAgent('proj1', 'a1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1', body);
    expect(result).toEqual(updated);
  });

  it('deleteAgent should call DELETE /projects/{projectUuid}/aiAgents/{agentUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteAgent('proj1', 'a1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1');
  });

  // ─── Project-scoped: threads ─────────────────────────────────────────────────

  it('listAgentThreads should call GET /projects/{projectUuid}/aiAgents/{agentUuid}/threads', async () => {
    const client = new AiAgentsClient(mockHttp);
    const threads = [{ uuid: 't1', title: 'Thread 1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(threads);
    const result = await client.listAgentThreads('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/threads');
    expect(result).toEqual(threads);
  });

  it('createAgentThread should call POST /projects/{projectUuid}/aiAgents/{agentUuid}/threads', async () => {
    const client = new AiAgentsClient(mockHttp);
    const thread = { uuid: 't1', title: null };
    vi.mocked(mockHttp.post).mockResolvedValue(thread);
    const result = await client.createAgentThread('proj1', 'a1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads',
      {},
      undefined,
    );
    expect(result).toEqual(thread);
  });

  it('createAgentThread with body should pass body to POST', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { prompt: 'Hello' };
    const thread = { uuid: 't1', title: null };
    vi.mocked(mockHttp.post).mockResolvedValue(thread);
    await client.createAgentThread('proj1', 'a1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads',
      body,
      undefined,
    );
  });

  it('getAgentThread should call GET .../threads/{threadUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    const thread = { uuid: 't1', messages: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(thread);
    const result = await client.getAgentThread('proj1', 'a1', 't1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/threads/t1', undefined);
    expect(result).toEqual(thread);
  });

  it('createAgentThreadMessage should call POST .../threads/{threadUuid}/messages', async () => {
    const client = new AiAgentsClient(mockHttp);
    const message = { uuid: 'm1', message: 'Hello', role: 'user' };
    vi.mocked(mockHttp.post).mockResolvedValue(message);
    const body = { prompt: 'What is the total revenue?' };
    const result = await client.createAgentThreadMessage('proj1', 'a1', 't1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/messages',
      body,
      undefined,
    );
    expect(result).toEqual(message);
  });

  it('createAgentThreadMessage should pass RequestOptions to POST', async () => {
    const client = new AiAgentsClient(mockHttp);
    const controller = new AbortController();
    vi.mocked(mockHttp.post).mockResolvedValue({ uuid: 'm1' });
    await client.createAgentThreadMessage(
      'proj1',
      'a1',
      't1',
      { prompt: 'Hi' },
      { signal: controller.signal, timeoutMs: 5000, requestId: 'req-1' },
    );
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/messages',
      { prompt: 'Hi' },
      {
        signal: controller.signal,
        timeout: 5000,
        headers: { 'X-Request-Id': 'req-1' },
      },
    );
  });

  it('generateAgentThreadResponse without body should call POST .../generate with no body', async () => {
    const client = new AiAgentsClient(mockHttp);
    const response = { response: 'Here is your answer.' };
    vi.mocked(mockHttp.post).mockResolvedValue(response);
    const result = await client.generateAgentThreadResponse('proj1', 'a1', 't1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/threads/t1/generate',
      undefined,
      undefined,
    );
    expect(result).toEqual(response);
  });

  it('generateAgentThreadResponse with prompt body should create message then generate', async () => {
    const client = new AiAgentsClient(mockHttp);
    const message = { uuid: 'm1', message: 'What is the total revenue?', role: 'user' };
    const response = { response: 'Here is your answer.' };
    vi.mocked(mockHttp.post).mockResolvedValueOnce(message).mockResolvedValueOnce(response);
    const result = await client.generateAgentThreadResponse('proj1', 'a1', 't1', {
      prompt: 'What is the total revenue?',
    });
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      1,
      '/projects/proj1/aiAgents/a1/threads/t1/messages',
      { prompt: 'What is the total revenue?' },
      undefined,
    );
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      2,
      '/projects/proj1/aiAgents/a1/threads/t1/generate',
      undefined,
      undefined,
    );
    expect(result).toEqual(response);
  });

  it('startConversation should create thread, message, and generate', async () => {
    const client = new AiAgentsClient(mockHttp);
    const thread = { uuid: 't1', title: null };
    const message = { uuid: 'm1', message: 'Hello', role: 'user' };
    const response = { response: 'Hi there.' };
    vi.mocked(mockHttp.post)
      .mockResolvedValueOnce(thread)
      .mockResolvedValueOnce(message)
      .mockResolvedValueOnce(response);
    const result = await client.startConversation('proj1', 'a1', { prompt: 'Hello' });
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      1,
      '/projects/proj1/aiAgents/a1/threads',
      {},
      undefined,
    );
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      2,
      '/projects/proj1/aiAgents/a1/threads/t1/messages',
      { prompt: 'Hello' },
      undefined,
    );
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      3,
      '/projects/proj1/aiAgents/a1/threads/t1/generate',
      undefined,
      undefined,
    );
    expect(result).toEqual({ thread, result: response });
  });

  it('continueConversation should create message then generate', async () => {
    const client = new AiAgentsClient(mockHttp);
    const message = { uuid: 'm2', message: 'Follow up', role: 'user' };
    const response = { response: 'Sure.' };
    vi.mocked(mockHttp.post).mockResolvedValueOnce(message).mockResolvedValueOnce(response);
    const result = await client.continueConversation('proj1', 'a1', 't1', { prompt: 'Follow up' });
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      1,
      '/projects/proj1/aiAgents/a1/threads/t1/messages',
      { prompt: 'Follow up' },
      undefined,
    );
    expect(mockHttp.post).toHaveBeenNthCalledWith(
      2,
      '/projects/proj1/aiAgents/a1/threads/t1/generate',
      undefined,
      undefined,
    );
    expect(result).toEqual(response);
  });

  // ─── Project-scoped: evaluations ─────────────────────────────────────────────

  it('listEvaluations should call GET .../evaluations', async () => {
    const client = new AiAgentsClient(mockHttp);
    const evals = [{ evalUuid: 'e1', title: 'Eval 1', agentUuid: 'a1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(evals);
    const result = await client.listEvaluations('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations');
    expect(result).toEqual(evals);
  });

  it('createEvaluation should call POST .../evaluations with body', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { title: 'My Eval', prompts: [] };
    const created = { evalUuid: 'e1' };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const result = await client.createEvaluation('proj1', 'a1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations', body);
    expect(result).toEqual(created);
  });

  it('getEvaluation should call GET .../evaluations/{evalUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    const evaluation = { evalUuid: 'e1', title: 'My Eval', prompts: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(evaluation);
    const result = await client.getEvaluation('proj1', 'a1', 'e1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1');
    expect(result).toEqual(evaluation);
  });

  it('updateEvaluation should call PATCH .../evaluations/{evalUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { title: 'Updated Eval' };
    const updated = { evalUuid: 'e1', title: 'Updated Eval', prompts: [] };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateEvaluation('proj1', 'a1', 'e1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1', body);
    expect(result).toEqual(updated);
  });

  it('appendToEvaluation should call POST .../evaluations/{evalUuid}/append and return evaluation', async () => {
    const client = new AiAgentsClient(mockHttp);
    const body = { prompts: [{ prompt: 'Extra?', expectedResponse: null }] };
    const updated = { evalUuid: 'e1', title: 'My Eval', prompts: body.prompts };
    vi.mocked(mockHttp.post).mockResolvedValue(updated);
    const result = await client.appendToEvaluation('proj1', 'a1', 'e1', body);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/evaluations/e1/append',
      body,
    );
    expect(result).toEqual(updated);
  });

  it('deleteEvaluation should call DELETE .../evaluations/{evalUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteEvaluation('proj1', 'a1', 'e1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1');
  });

  // ─── Project-scoped: evaluation runs ─────────────────────────────────────────

  it('runEvaluation should call POST .../evaluations/{evalUuid}/run', async () => {
    const client = new AiAgentsClient(mockHttp);
    const runSummary = { runUuid: 'r1', evalUuid: 'e1', status: 'pending' };
    vi.mocked(mockHttp.post).mockResolvedValue(runSummary);
    const result = await client.runEvaluation('proj1', 'a1', 'e1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/evaluations/e1/run',
      {},
    );
    expect(result).toEqual(runSummary);
  });

  it('listEvaluationRuns should return full paginated response', async () => {
    const client = new AiAgentsClient(mockHttp);
    const runs = [{ runUuid: 'r1', evalUuid: 'e1', status: 'completed' }];
    const pagedResponse = {
      data: { runs },
      pagination: { totalResults: 1, totalPageCount: 1 },
    };
    vi.mocked(mockHttp.get).mockResolvedValue(pagedResponse);
    const result = await client.listEvaluationRuns('proj1', 'a1', 'e1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1/runs');
    expect(result).toEqual(pagedResponse);
  });

  it('listAllEvaluationRuns should unwrap runs array from paginated response', async () => {
    const client = new AiAgentsClient(mockHttp);
    const runs = [{ runUuid: 'r1', evalUuid: 'e1', status: 'completed' }];
    const pagedResponse = {
      data: { runs },
      pagination: { totalResults: 1, totalPageCount: 1 },
    };
    vi.mocked(mockHttp.get).mockResolvedValue(pagedResponse);
    const result = await client.listAllEvaluationRuns('proj1', 'a1', 'e1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1/runs');
    expect(result).toEqual(runs);
  });

  it('getEvaluationRunResults should call GET .../evaluations/{evalUuid}/runs/{runUuid}', async () => {
    const client = new AiAgentsClient(mockHttp);
    const run = { runUuid: 'r1', evalUuid: 'e1', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(run);
    const result = await client.getEvaluationRunResults('proj1', 'a1', 'e1', 'r1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/evaluations/e1/runs/r1');
    expect(result).toEqual(run);
  });
});
