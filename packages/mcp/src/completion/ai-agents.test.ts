import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAgentUuidCompleter,
  createEvalUuidCompleter,
  createRunUuidCompleter,
} from './ai-agents.js';

import type { LightdashClient } from '@lightdash-tools/client';

const ALLOWED = '11111111-1111-1111-1111-111111111111';
const FORBIDDEN = '22222222-2222-2222-2222-222222222222';
const AGENT = '33333333-3333-3333-3333-333333333333';
const EVAL = '44444444-4444-4444-4444-444444444444';

describe('AI agent completion allowlists', () => {
  const originalEnv = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    } else {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = originalEnv;
    }
  });

  it('blocks agent UUID completion for disallowed projectUuid', async () => {
    process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = ALLOWED;
    const listAgents = vi.fn();
    const client = {
      v1: { aiAgents: { listAgents } },
    } as unknown as LightdashClient;

    const complete = createAgentUuidCompleter(client);
    const results = await complete('', { arguments: { projectUuid: FORBIDDEN } });

    expect(results).toEqual([]);
    expect(listAgents).not.toHaveBeenCalled();
  });

  it('blocks evaluation UUID completion for disallowed projectUuid', async () => {
    process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = ALLOWED;
    const listEvaluations = vi.fn();
    const client = {
      v1: { aiAgents: { listEvaluations } },
    } as unknown as LightdashClient;

    const complete = createEvalUuidCompleter(client);
    const results = await complete('', {
      arguments: { projectUuid: FORBIDDEN, agentUuid: AGENT },
    });

    expect(results).toEqual([]);
    expect(listEvaluations).not.toHaveBeenCalled();
  });

  it('blocks run UUID completion for disallowed projectUuid', async () => {
    process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = ALLOWED;
    const listAllEvaluationRuns = vi.fn();
    const client = {
      v1: { aiAgents: { listAllEvaluationRuns } },
    } as unknown as LightdashClient;

    const complete = createRunUuidCompleter(client);
    const results = await complete('', {
      arguments: { projectUuid: FORBIDDEN, agentUuid: AGENT, evalUuid: EVAL },
    });

    expect(results).toEqual([]);
    expect(listAllEvaluationRuns).not.toHaveBeenCalled();
  });
});
