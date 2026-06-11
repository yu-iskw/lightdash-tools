import { describe, expect, it, vi } from 'vitest';

import { applyBundleDiff } from './apply-bundle-diff';

import type { LightdashClient } from '../client';
import type { BundleDiffChange, LightdashAiAgentBundle } from '@lightdash-tools/common';

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

describe('applyBundleDiff', () => {
  it('records API failures without aborting remaining changes', async () => {
    const deleteAgent = vi
      .fn()
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockResolvedValueOnce(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent: vi.fn(),
          deleteAgent,
          createEvaluation: vi.fn(),
          updateEvaluation: vi.fn(),
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const changes: BundleDiffChange[] = [
      {
        resourceType: 'agent',
        operation: 'delete',
        key: 'agent-1',
        path: 'agents[agent-1]',
      },
      {
        resourceType: 'agent',
        operation: 'delete',
        key: 'agent-2',
        path: 'agents[agent-2]',
      },
    ];

    const result = await applyBundleDiff(client, bundle, changes);

    expect(deleteAgent).toHaveBeenCalledTimes(2);
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toBe('delete failed');
  });
});
