import { computeBundleDiff } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { applyBundleDiff } from './apply-bundle-diff';

import type { LightdashClient } from '../client';
import type { BundleDiffChange, LightdashAiAgentBundle } from '@lightdash-tools/common';

const PROJECT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const AGENT_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EVAL_UUID = '770e8400-e29b-41d4-a716-446655440002';
const STALE_AGENT_UUID = '660e8400-e29b-41d4-a716-446655440099';
const STALE_EVAL_UUID = '770e8400-e29b-41d4-a716-446655440099';

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

  it('applies name-matched agent update using agentUuid from diff', async () => {
    const nameMatchedBundle: LightdashAiAgentBundle = {
      apiVersion: 'lightdash.ai/v1alpha1',
      kind: 'LightdashAiAgentBundle',
      metadata: { name: 'test-bundle' },
      spec: {
        projectUuid: PROJECT_UUID,
        agents: [
          {
            key: 'a1',
            name: 'Agent One',
            instruction: 'Updated instruction',
            evaluations: [],
          },
        ],
      },
    };

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Agent One',
            description: null,
            instruction: 'Original instruction',
            tags: null,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(nameMatchedBundle, current);
    const updateAgent = vi.fn().mockResolvedValue(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent,
          deleteAgent: vi.fn(),
          createEvaluation: vi.fn(),
          updateEvaluation: vi.fn(),
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const result = await applyBundleDiff(client, nameMatchedBundle, diff.changes);

    expect(updateAgent).toHaveBeenCalledWith(PROJECT_UUID, AGENT_UUID, {
      uuid: AGENT_UUID,
      name: 'Agent One',
      description: null,
      instruction: 'Updated instruction',
      tags: null,
    });
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(0);
  });

  it('applies name-matched agent update when bundle uuid is stale', async () => {
    const staleUuidBundle: LightdashAiAgentBundle = {
      apiVersion: 'lightdash.ai/v1alpha1',
      kind: 'LightdashAiAgentBundle',
      metadata: { name: 'test-bundle' },
      spec: {
        projectUuid: PROJECT_UUID,
        agents: [
          {
            key: 'a1',
            uuid: STALE_AGENT_UUID,
            name: 'Agent One',
            instruction: 'Updated instruction',
            evaluations: [],
          },
        ],
      },
    };

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Agent One',
            description: null,
            instruction: 'Original instruction',
            tags: null,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(staleUuidBundle, current);
    const updateAgent = vi.fn().mockResolvedValue(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent,
          deleteAgent: vi.fn(),
          createEvaluation: vi.fn(),
          updateEvaluation: vi.fn(),
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const result = await applyBundleDiff(client, staleUuidBundle, diff.changes);

    expect(updateAgent).toHaveBeenCalledWith(
      PROJECT_UUID,
      AGENT_UUID,
      expect.objectContaining({ uuid: AGENT_UUID, instruction: 'Updated instruction' }),
    );
    expect(updateAgent).not.toHaveBeenCalledWith(PROJECT_UUID, STALE_AGENT_UUID, expect.anything());
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(0);
  });

  it('applies title-matched evaluation update using evaluationUuid from diff', async () => {
    const titleMatchedBundle: LightdashAiAgentBundle = {
      apiVersion: 'lightdash.ai/v1alpha1',
      kind: 'LightdashAiAgentBundle',
      metadata: { name: 'test-bundle' },
      spec: {
        projectUuid: PROJECT_UUID,
        agents: [
          {
            key: 'a1',
            uuid: AGENT_UUID,
            name: 'Agent One',
            evaluations: [
              {
                key: 'e1',
                title: 'Smoke Tests',
                prompts: [{ prompt: 'Updated prompt', expectedResponse: null }],
              },
            ],
          },
        ],
      },
    };

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Agent One',
            description: null,
            instruction: null,
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: null,
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'Original prompt',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = computeBundleDiff(titleMatchedBundle, current);
    const updateEvaluation = vi.fn().mockResolvedValue(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent: vi.fn(),
          deleteAgent: vi.fn(),
          createEvaluation: vi.fn(),
          updateEvaluation,
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const result = await applyBundleDiff(client, titleMatchedBundle, diff.changes);

    expect(updateEvaluation).toHaveBeenCalledWith(
      PROJECT_UUID,
      AGENT_UUID,
      EVAL_UUID,
      expect.objectContaining({
        title: 'Smoke Tests',
        prompts: [{ prompt: 'Updated prompt', expectedResponse: null }],
      }),
    );
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(0);
  });

  it('applies title-matched evaluation update when bundle uuid is stale', async () => {
    const staleEvalBundle: LightdashAiAgentBundle = {
      apiVersion: 'lightdash.ai/v1alpha1',
      kind: 'LightdashAiAgentBundle',
      metadata: { name: 'test-bundle' },
      spec: {
        projectUuid: PROJECT_UUID,
        agents: [
          {
            key: 'a1',
            uuid: AGENT_UUID,
            name: 'Agent One',
            evaluations: [
              {
                key: 'e1',
                uuid: STALE_EVAL_UUID,
                title: 'Smoke Tests',
                prompts: [{ prompt: 'Updated prompt', expectedResponse: null }],
              },
            ],
          },
        ],
      },
    };

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Agent One',
            description: null,
            instruction: null,
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: null,
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'Original prompt',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = computeBundleDiff(staleEvalBundle, current);
    const updateEvaluation = vi.fn().mockResolvedValue(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent: vi.fn(),
          deleteAgent: vi.fn(),
          createEvaluation: vi.fn(),
          updateEvaluation,
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const result = await applyBundleDiff(client, staleEvalBundle, diff.changes);

    expect(updateEvaluation).toHaveBeenCalledWith(
      PROJECT_UUID,
      AGENT_UUID,
      EVAL_UUID,
      expect.objectContaining({
        title: 'Smoke Tests',
        prompts: [{ prompt: 'Updated prompt', expectedResponse: null }],
      }),
    );
    expect(updateEvaluation).not.toHaveBeenCalledWith(
      PROJECT_UUID,
      AGENT_UUID,
      STALE_EVAL_UUID,
      expect.anything(),
    );
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(0);
  });

  it('clears evaluation description when bundle omits it', async () => {
    const bundleWithoutDescription: LightdashAiAgentBundle = {
      apiVersion: 'lightdash.ai/v1alpha1',
      kind: 'LightdashAiAgentBundle',
      metadata: { name: 'test-bundle' },
      spec: {
        projectUuid: PROJECT_UUID,
        agents: [
          {
            key: 'a1',
            uuid: AGENT_UUID,
            name: 'Agent One',
            evaluations: [
              {
                key: 'e1',
                uuid: EVAL_UUID,
                title: 'Smoke Tests',
                prompts: [{ prompt: 'Same prompt', expectedResponse: null }],
              },
            ],
          },
        ],
      },
    };

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Agent One',
            description: null,
            instruction: null,
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: 'Old description',
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'Same prompt',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = computeBundleDiff(bundleWithoutDescription, current);
    const updateEvaluation = vi.fn().mockResolvedValue(undefined);
    const client = {
      v1: {
        aiAgents: {
          createAgent: vi.fn(),
          updateAgent: vi.fn(),
          deleteAgent: vi.fn(),
          createEvaluation: vi.fn(),
          updateEvaluation,
          deleteEvaluation: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const result = await applyBundleDiff(client, bundleWithoutDescription, diff.changes);

    expect(updateEvaluation).toHaveBeenCalledWith(
      PROJECT_UUID,
      AGENT_UUID,
      EVAL_UUID,
      expect.objectContaining({
        title: 'Smoke Tests',
        description: null,
      }),
    );
    expect(result.applied).toBe(1);
    expect(result.failed).toHaveLength(0);
  });
});
