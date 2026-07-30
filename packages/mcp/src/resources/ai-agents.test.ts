import { SafetyMode } from '@lightdash-tools/common';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EVALUATION_RUN_RESULTS_URI_TEMPLATE, registerAiAgentResources } from './ai-agents.js';

import type { McpContextProvider } from '../request-context.js';

describe('registerAiAgentResources', () => {
  const mockGetResults = vi.fn();
  const mockClient = {
    v1: {
      aiAgents: {
        getEvaluationRunResults: mockGetResults,
      },
    },
  };
  const mockContextProvider = {
    getContext: async () => ({
      lightdashClient: mockClient as never,
      auth: { mode: 'env' as const },
      governance: {
        safetyMode: SafetyMode.READ_ONLY,
        dryRun: false,
        allowedProjectUuids: [],
      },
    }),
  } satisfies McpContextProvider;

  let server: McpServer;
  let registerResourceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerResourceSpy = vi.spyOn(server, 'registerResource');
    mockGetResults.mockReset();
    mockGetResults.mockResolvedValue({ runUuid: 'run-1', status: 'completed' });
  });

  it('registers evaluation run results resource template', () => {
    registerAiAgentResources(server, mockContextProvider);

    expect(registerResourceSpy).toHaveBeenCalledTimes(1);
    const [name, template, metadata] = registerResourceSpy.mock.calls[0];
    expect(name).toBe('ai_agent_evaluation_run_results');
    expect(template.uriTemplate.toString()).toBe(EVALUATION_RUN_RESULTS_URI_TEMPLATE);
    expect(metadata).toMatchObject({
      mimeType: 'application/json',
    });
  });

  it('read handler fetches run results and returns JSON resource contents', async () => {
    registerAiAgentResources(server, mockContextProvider);

    const readCallback = registerResourceSpy.mock.calls[0][3] as (
      uri: URL,
      vars: Record<string, string>,
    ) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

    const uri = new URL(
      'lightdash://projects/proj-1/ai-agents/agent-1/evaluations/eval-1/runs/run-1/results',
    );
    const result = await readCallback(uri, {
      projectUuid: 'proj-1',
      agentUuid: 'agent-1',
      evalUuid: 'eval-1',
      runUuid: 'run-1',
    });

    expect(mockGetResults).toHaveBeenCalledWith('proj-1', 'agent-1', 'eval-1', 'run-1');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe('application/json');
    expect(JSON.parse(result.contents[0].text)).toEqual({
      runUuid: 'run-1',
      status: 'completed',
    });
    expect(result.contents[0].uri).toBe(uri.href);
  });
});
