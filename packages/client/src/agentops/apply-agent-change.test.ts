import {
  resolveSecureAgentCreateFlags,
  SECURE_AGENT_CREATE_DEFAULTS,
} from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { applyAgentChange } from './apply-agent-change.js';

import type { ApplyBundleContext } from './apply-context';
import type { LightdashAiAgentBundle } from '@lightdash-tools/common';

const PROJECT_UUID = '550e8400-e29b-41d4-a716-446655440000';

const bundle: LightdashAiAgentBundle = {
  apiVersion: 'lightdash.ai/v1alpha1',
  kind: 'LightdashAiAgentBundle',
  metadata: { name: 'test-bundle' },
  spec: {
    projectUuid: PROJECT_UUID,
    agents: [
      {
        key: 'a1',
        name: 'Governed Agent',
        evaluations: [],
      },
    ],
  },
};

function makeCreateContext(createAgent: ReturnType<typeof vi.fn>): ApplyBundleContext {
  return {
    bundle,
    projectUuid: PROJECT_UUID,
    client: {
      v1: {
        aiAgents: {
          createAgent,
          updateAgent: vi.fn(),
          deleteAgent: vi.fn(),
        },
      },
    } as unknown as ApplyBundleContext['client'],
    agentUuidByKey: new Map(),
    failed: [],
  };
}

describe('applyAgentChange create', () => {
  it('applies secure defaults when bundle omits permission flags', async () => {
    const createAgent = vi.fn().mockResolvedValue({ uuid: 'agent-1', name: 'Governed Agent' });
    const ctx = makeCreateContext(createAgent);

    const ok = await applyAgentChange(ctx, {
      resourceType: 'agent',
      operation: 'create',
      key: 'a1',
      path: 'agents[a1]',
    });

    expect(ok).toBe(true);
    expect(createAgent).toHaveBeenCalledWith(
      PROJECT_UUID,
      expect.objectContaining(resolveSecureAgentCreateFlags({})),
    );
    expect(createAgent.mock.calls[0]?.[1]).toMatchObject(SECURE_AGENT_CREATE_DEFAULTS);
  });
});

describe('applyAgentChange update', () => {
  it('forwards optional permission fields from bundle spec', async () => {
    const updateAgent = vi.fn().mockResolvedValue({});
    const bundleWithPerms: LightdashAiAgentBundle = {
      ...bundle,
      spec: {
        ...bundle.spec,
        agents: [
          {
            key: 'a1',
            uuid: 'agent-1',
            name: 'Governed Agent',
            enableContentTools: true,
            adminOnly: false,
            evaluations: [],
          },
        ],
      },
    };
    const ctx: ApplyBundleContext = {
      bundle: bundleWithPerms,
      projectUuid: PROJECT_UUID,
      client: {
        v1: {
          aiAgents: {
            createAgent: vi.fn(),
            updateAgent,
            deleteAgent: vi.fn(),
          },
        },
      } as unknown as ApplyBundleContext['client'],
      agentUuidByKey: new Map(),
      failed: [],
    };

    const ok = await applyAgentChange(ctx, {
      resourceType: 'agent',
      operation: 'update',
      key: 'a1',
      agentUuid: 'agent-1',
      path: 'agents[a1]',
    });

    expect(ok).toBe(true);
    expect(updateAgent).toHaveBeenCalledWith(PROJECT_UUID, 'agent-1', {
      uuid: 'agent-1',
      name: 'Governed Agent',
      description: null,
      instruction: null,
      tags: null,
      enableContentTools: true,
      adminOnly: false,
    });
  });
});
