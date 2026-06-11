import { describe, expect, it, vi } from 'vitest';

import { fetchBundleCurrentState } from './fetch-bundle-state';

import type { LightdashClient } from '../client';
import type { LightdashAiAgentBundle } from '@lightdash-tools/common';

const bundle: LightdashAiAgentBundle = {
  apiVersion: 'lightdash.ai/v1alpha1',
  kind: 'LightdashAiAgentBundle',
  metadata: { name: 'test-bundle' },
  spec: {
    projectUuid: '550e8400-e29b-41d4-a716-446655440000',
    agents: [
      {
        key: 'a1',
        name: 'Agent One',
        evaluations: [],
      },
    ],
  },
};

describe('fetchBundleCurrentState', () => {
  it('fetches all project agents so orphan deletes can be computed', async () => {
    const listAgents = vi.fn().mockResolvedValue([
      { uuid: 'agent-in-bundle', name: 'Agent One' },
      { uuid: 'orphan-agent', name: 'Orphan' },
    ]);
    const getAgent = vi
      .fn()
      .mockImplementation(async (_projectUuid: string, agentUuid: string) => ({
        uuid: agentUuid,
        name: agentUuid === 'agent-in-bundle' ? 'Agent One' : 'Orphan',
        description: null,
        instruction: null,
        tags: null,
      }));
    const listEvaluations = vi.fn().mockResolvedValue([]);
    const getEvaluation = vi.fn();

    const client = {
      v1: {
        aiAgents: {
          listAgents,
          getAgent,
          listEvaluations,
          getEvaluation,
        },
      },
    } as unknown as LightdashClient;

    const state = await fetchBundleCurrentState(client, bundle);

    expect(listAgents).toHaveBeenCalledWith(bundle.spec.projectUuid);
    expect(getAgent).toHaveBeenCalledTimes(2);
    expect(state.agents.map((entry) => entry.agent.uuid)).toEqual([
      'agent-in-bundle',
      'orphan-agent',
    ]);
  });
});
