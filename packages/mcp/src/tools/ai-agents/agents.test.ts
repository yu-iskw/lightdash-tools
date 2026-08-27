import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  registerCreateProjectAgent,
  registerGetProjectAgent,
  registerGetUserAgentPreferences,
  registerListProjectAgents,
  registerUpdateProjectAgent,
} from './agents.js';
import { registerEvaluateAgentReadiness } from './discovery.js';
import { registerGetAgentEvalRunResults, registerRunAgentEvaluation } from './evaluations.js';
import {
  redactEvalRunResults,
  redactEvaluationPayload,
  redactThreadMessages,
  redactThreadSummaries,
} from './helpers.js';
import {
  mockAiAgentsContext,
  parseAiAgentToolBody,
  registeredAiAgentTool,
} from './test-support.js';

const PROJECT = '11111111-1111-1111-1111-111111111111';
const AGENT = '22222222-2222-2222-2222-222222222222';
const EVAL_UUID = '33333333-3333-3333-3333-333333333333';
const RUN = '44444444-4444-4444-4444-444444444444';

describe('ai-agents helpers', () => {
  it('redacts message bodies, firstMessage, and nested tool I/O by default', () => {
    const { data, warnings } = redactThreadMessages(
      {
        uuid: 't1',
        firstMessage: { message: 'secret opener', uuid: 'm0' },
        title: 'secret title',
        messages: [
          {
            message: 'secret question',
            role: 'assistant',
            context: [{ type: 'file', path: '/secret.sql' }],
            reasoning: [{ text: 'think', uuid: 'r1' }],
            steers: [{ message: 'steer me', uuid: 's1' }],
            toolCalls: [{ toolName: 'runSql', toolArgs: { sql: 'select 1' } }],
            toolResults: [{ result: { rows: [1] } }],
            humanFeedback: 'nice',
            errorMessage: 'boom',
          },
        ],
      },
      false,
    );
    expect(warnings).toHaveLength(1);
    const thread = data as {
      title: string;
      firstMessage: { message: string };
      messages: Array<{
        message: string;
        context: unknown;
        humanFeedback: string;
        errorMessage: string;
        reasoning: Array<{ text: string }>;
        steers: Array<{ message: string }>;
        toolCalls: Array<{ toolArgs: unknown }>;
        toolResults: Array<{ result: unknown }>;
      }>;
    };
    expect(thread.title).toBe('[REDACTED]');
    expect(thread.firstMessage.message).toBe('[REDACTED]');
    expect(thread.messages[0]?.message).toBe('[REDACTED]');
    expect(thread.messages[0]?.context).toEqual([{ redacted: true }]);
    expect(thread.messages[0]?.humanFeedback).toBe('[REDACTED]');
    expect(thread.messages[0]?.errorMessage).toBe('[REDACTED]');
    expect(thread.messages[0]?.reasoning[0]?.text).toBe('[REDACTED]');
    expect(thread.messages[0]?.steers[0]?.message).toBe('[REDACTED]');
    expect(thread.messages[0]?.toolCalls[0]?.toolArgs).toEqual({ redacted: true });
    expect(thread.messages[0]?.toolResults[0]?.result).toBe('[REDACTED]');
  });

  it('keeps message bodies when includeMessageText is true', () => {
    const { data, warnings } = redactThreadMessages(
      {
        uuid: 't1',
        firstMessage: { message: 'secret opener', uuid: 'm0' },
        messages: [{ message: 'secret question', role: 'user' }],
      },
      true,
    );
    expect(warnings).toHaveLength(0);
    const thread = data as {
      firstMessage: { message: string };
      messages: Array<{ message: string }>;
    };
    expect(thread.firstMessage.message).toBe('secret opener');
    expect(thread.messages[0]?.message).toBe('secret question');
  });

  it('redacts firstMessage and title on thread summaries', () => {
    const { data, warnings } = redactThreadSummaries(
      [{ uuid: 't1', title: 'from chat', firstMessage: { message: 'hello', uuid: 'm0' } }],
      false,
    );
    expect(warnings).toHaveLength(1);
    const row = (data as Array<{ title: string; firstMessage: { message: string } }>)[0];
    expect(row?.title).toBe('[REDACTED]');
    expect(row?.firstMessage.message).toBe('[REDACTED]');
  });

  it('redacts evaluation prompt text by default', () => {
    const { data, warnings } = redactEvaluationPayload(
      {
        evalUuid: 'e1',
        prompts: [{ prompt: 'secret', expectedResponse: 'answer', type: 'string' }],
      },
      false,
    );
    expect(warnings).toHaveLength(1);
    const prompts = (data as { prompts: Array<{ prompt: string; expectedResponse: string }> })
      .prompts;
    expect(prompts[0]?.prompt).toBe('[REDACTED]');
    expect(prompts[0]?.expectedResponse).toBe('[REDACTED]');
  });

  it('redacts eval run result prompt text, errorMessage, and assessment reason', () => {
    const { data, warnings } = redactEvalRunResults(
      {
        results: [
          {
            prompt: 'q',
            expectedResponse: 'a',
            errorMessage: 'warehouse blew up',
            assessment: { reason: 'because', passed: true },
          },
        ],
      },
      false,
    );
    expect(warnings).toHaveLength(1);
    const result = (
      data as {
        results: Array<{
          prompt: string;
          expectedResponse: string;
          errorMessage: string;
          assessment: { reason: string };
        }>;
      }
    ).results[0];
    expect(result?.prompt).toBe('[REDACTED]');
    expect(result?.expectedResponse).toBe('[REDACTED]');
    expect(result?.errorMessage).toBe('[REDACTED]');
    expect(result?.assessment.reason).toBe('[REDACTED]');
  });
});

describe('ai-agent-ops tools', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('lists agents when projectUuid is passed', async () => {
    const listAgents = vi.fn().mockResolvedValue([{ uuid: AGENT, name: 'Revenue' }]);
    const { handler } = registeredAiAgentTool(
      registerListProjectAgents,
      mockAiAgentsContext({ listAgents }),
      'list_project_agents',
    );
    const result = await handler({ projectUuid: PROJECT });
    expect(result.isError).toBeUndefined();
    const body = parseAiAgentToolBody(result);
    expect(listAgents).toHaveBeenCalledWith(PROJECT);
    expect(body.data).toEqual([{ uuid: AGENT, name: 'Revenue' }]);
    expect((body.context as { projectUuid: string }).projectUuid).toBe(PROJECT);
  });

  it('labels readiness as non-e2e', async () => {
    const evaluateAgentReadiness = vi.fn().mockResolvedValue({ score: 0.8 });
    const { handler } = registeredAiAgentTool(
      registerEvaluateAgentReadiness,
      mockAiAgentsContext({ evaluateAgentReadiness }),
      'evaluate_agent_readiness',
    );
    const result = await handler({ projectUuid: PROJECT, agentUuid: AGENT });
    const body = parseAiAgentToolBody(result);
    expect(body.mode).toBe('project_readiness_api');
    expect((body.limitations as string[])[0]).toMatch(/not an evaluation-suite run/i);
  });

  it('run evaluation notes CLI gate ownership', async () => {
    const runEvaluation = vi.fn().mockResolvedValue({ runUuid: RUN, status: 'pending' });
    const { handler } = registeredAiAgentTool(
      registerRunAgentEvaluation,
      mockAiAgentsContext({ runEvaluation }),
      'run_agent_evaluation',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      evalUuid: EVAL_UUID,
    });
    const body = parseAiAgentToolBody(result);
    expect(body.mode).toBe('lightdash_agent_evaluation_run');
    expect((body.limitations as string[]).join(' ')).toMatch(/agentops evaluate-gate/);
  });

  it('get run results does not claim gate passed', async () => {
    const getEvaluationRunResults = vi
      .fn()
      .mockResolvedValue({ runUuid: RUN, status: 'completed' });
    const { handler } = registeredAiAgentTool(
      registerGetAgentEvalRunResults,
      mockAiAgentsContext({ getEvaluationRunResults }),
      'get_agent_eval_run_results',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      evalUuid: EVAL_UUID,
      runUuid: RUN,
    });
    const body = parseAiAgentToolBody(result);
    expect((body.limitations as string[]).join(' ')).toMatch(/evaluate-gate/);
    expect((body.limitations as string[]).join(' ')).not.toMatch(/gate passed/i);
  });

  it('surfaces PROJECT_SCOPE_REQUIRED when unresolved', async () => {
    const getAgent = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerGetProjectAgent,
      mockAiAgentsContext({ getAgent }),
      'get_project_agent',
    );
    const result = await handler({ agentUuid: AGENT });
    expect(result.isError).toBe(true);
    const body = parseAiAgentToolBody(result);
    expect((body.error as { code: string }).code).toBe('PROJECT_SCOPE_REQUIRED');
    expect(getAgent).not.toHaveBeenCalled();
  });

  it('reads user agent preferences', async () => {
    const getUserAgentPreferences = vi.fn().mockResolvedValue({ defaultAgentUuid: AGENT });
    const { handler } = registeredAiAgentTool(
      registerGetUserAgentPreferences,
      mockAiAgentsContext({ getUserAgentPreferences }),
      'get_user_agent_preferences',
    );
    const result = await handler({ projectUuid: PROJECT });
    expect(result.isError).toBeUndefined();
    expect(getUserAgentPreferences).toHaveBeenCalledWith(PROJECT);
    expect(parseAiAgentToolBody(result).data).toEqual({ defaultAgentUuid: AGENT });
  });

  it('registers create_project_agent as WRITE_NONDESTRUCTIVE', () => {
    const createAgent = vi.fn();
    const { options } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent }),
      'create_project_agent',
    );
    expect(options).toMatchObject({
      annotations: expect.objectContaining({
        readOnlyHint: false,
        destructiveHint: false,
      }),
    });
  });

  it('updates a project agent with partial patch body', async () => {
    const updateAgent = vi.fn().mockResolvedValue({ uuid: AGENT, instruction: 'Updated' });
    const { handler } = registeredAiAgentTool(
      registerUpdateProjectAgent,
      mockAiAgentsContext({ updateAgent }),
      'update_project_agent',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      instruction: 'Updated',
    });
    expect(result.isError).toBeUndefined();
    expect(updateAgent).toHaveBeenCalledWith(PROJECT, AGENT, {
      uuid: AGENT,
      instruction: 'Updated',
    });
    expect(parseAiAgentToolBody(result).data).toEqual({ uuid: AGENT, instruction: 'Updated' });
  });

  it('surfaces PROJECT_SCOPE_REQUIRED for get_user_agent_preferences when unresolved', async () => {
    const getUserAgentPreferences = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerGetUserAgentPreferences,
      mockAiAgentsContext({ getUserAgentPreferences }),
      'get_user_agent_preferences',
    );
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect((parseAiAgentToolBody(result).error as { code: string }).code).toBe(
      'PROJECT_SCOPE_REQUIRED',
    );
    expect(getUserAgentPreferences).not.toHaveBeenCalled();
  });
});
