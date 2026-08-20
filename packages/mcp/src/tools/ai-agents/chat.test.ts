/**
 * AI-agent conversation write / preference MCP tools (ADR-0029).
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS, logAuditEntry } from '@lightdash-tools/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import { resetAvailableProjectsCache } from '../../governance/available-projects.js';
import { runWithProjectPinAsync } from '../../governance/project-pin.js';
import { TOOL_PREFIX } from '../shared.js';

import { registerGetUserAgentPreferences } from './agents.js';
import { THREAD_PROMPT_MAX_CHARS, threadPromptField } from './helpers.js';
import {
  mockAiAgentsContext,
  parseAiAgentToolBody,
  registeredAiAgentTool,
} from './test-support.js';
import {
  GENERATE_AGENT_RESPONSE_TIMEOUT_MS,
  registerCreateAgentThread,
  registerCreateAgentThreadMessage,
  registerGenerateAgentResponse,
} from './threads.js';

vi.mock('@lightdash-tools/common', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getSessionId: () => 'test-session',
    logAuditEntry: vi.fn(),
    initAuditLog: vi.fn(),
  };
});

const PROJECT = '11111111-1111-1111-1111-111111111111';
const OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENT = '22222222-2222-2222-2222-222222222222';
const THREAD = '33333333-3333-3333-3333-333333333333';

describe('threadPromptField', () => {
  const schema = threadPromptField();

  it('rejects empty, whitespace-only, and oversized prompts', () => {
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('   ').success).toBe(false);
    expect(schema.safeParse('a'.repeat(THREAD_PROMPT_MAX_CHARS + 1)).success).toBe(false);
  });

  it('accepts a trimmed non-empty prompt within the ceiling', () => {
    expect(schema.safeParse('  hello  ').success).toBe(true);
    expect(schema.safeParse('a'.repeat(THREAD_PROMPT_MAX_CHARS)).success).toBe(true);
  });
});

describe('ai-agent-chat tools', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS];
    resetAvailableProjectsCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(logAuditEntry).mockClear();
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

  it('creates a thread with no extra body', async () => {
    const createAgentThread = vi.fn().mockResolvedValue({ uuid: THREAD });
    const { handler, options } = registeredAiAgentTool(
      registerCreateAgentThread,
      mockAiAgentsContext({ createAgentThread }),
      'create_agent_thread',
    );
    expect(Object.keys(options.inputSchema).sort()).toEqual(['agentUuid', 'projectUuid']);
    const result = await handler({ projectUuid: PROJECT, agentUuid: AGENT });
    expect(createAgentThread).toHaveBeenCalledWith(PROJECT, AGENT, {});
    expect(parseAiAgentToolBody(result).data).toEqual({ uuid: THREAD });
  });

  it('creates a thread message with prompt only', async () => {
    const createAgentThreadMessage = vi.fn().mockResolvedValue({ uuid: 'msg-1' });
    const { handler, options } = registeredAiAgentTool(
      registerCreateAgentThreadMessage,
      mockAiAgentsContext({ createAgentThreadMessage }),
      'create_agent_thread_message',
    );
    expect(Object.keys(options.inputSchema).sort()).toEqual([
      'agentUuid',
      'projectUuid',
      'prompt',
      'threadUuid',
    ]);
    expect(options.inputSchema).not.toHaveProperty('allUsers');
    expect(options.inputSchema).not.toHaveProperty('enableSqlMode');
    expect(options.inputSchema).not.toHaveProperty('autoApproveSql');
    expect(options.inputSchema).not.toHaveProperty('toolHints');
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      threadUuid: THREAD,
      prompt: 'What is revenue?',
    });
    expect(createAgentThreadMessage).toHaveBeenCalledWith(PROJECT, AGENT, THREAD, {
      prompt: 'What is revenue?',
    });
    expect(parseAiAgentToolBody(result).data).toEqual({ uuid: 'msg-1' });
  });

  it('generates via generateAgentThreadResponse with a bounded timeout', async () => {
    const generateAgentThreadResponse = vi.fn().mockResolvedValue({ response: 'secret answer' });
    const { handler, options } = registeredAiAgentTool(
      registerGenerateAgentResponse,
      mockAiAgentsContext({ generateAgentThreadResponse }),
      'generate_agent_response',
    );
    expect(Object.keys(options.inputSchema).sort()).toEqual([
      'agentUuid',
      'projectUuid',
      'threadUuid',
    ]);
    expect(options.inputSchema).not.toHaveProperty('prompt');
    expect(options.inputSchema).not.toHaveProperty('enableSqlMode');
    expect(options.inputSchema).not.toHaveProperty('autoApproveSql');
    expect(options.inputSchema).not.toHaveProperty('toolHints');
    expect(options.inputSchema).not.toHaveProperty('allUsers');
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      threadUuid: THREAD,
    });
    expect(generateAgentThreadResponse).toHaveBeenCalledWith(PROJECT, AGENT, THREAD, {
      timeoutMs: GENERATE_AGENT_RESPONSE_TIMEOUT_MS,
    });
    const body = parseAiAgentToolBody(result);
    expect(body.data).toEqual({ response: 'secret answer' });
    expect(body.mode).toBe('lightdash_ai_agent_generate');
    expect((body.limitations as string[]).join(' ')).toMatch(/not \/stream/i);
  });

  it.each([
    {
      register: registerGetUserAgentPreferences,
      id: 'get_user_agent_preferences',
      args: {},
      stub: 'getUserAgentPreferences',
    },
    {
      register: registerCreateAgentThread,
      id: 'create_agent_thread',
      args: { agentUuid: AGENT },
      stub: 'createAgentThread',
    },
    {
      register: registerCreateAgentThreadMessage,
      id: 'create_agent_thread_message',
      args: { agentUuid: AGENT, threadUuid: THREAD, prompt: 'hi' },
      stub: 'createAgentThreadMessage',
    },
    {
      register: registerGenerateAgentResponse,
      id: 'generate_agent_response',
      args: { agentUuid: AGENT, threadUuid: THREAD },
      stub: 'generateAgentThreadResponse',
    },
  ] as const)('surfaces PROJECT_SCOPE_REQUIRED for $id when unresolved', async (row) => {
    const stub = vi.fn();
    const { handler } = registeredAiAgentTool(
      row.register,
      mockAiAgentsContext({ [row.stub]: stub }),
      row.id,
    );
    const result = await handler(row.args);
    expect(result.isError).toBe(true);
    expect((parseAiAgentToolBody(result).error as { code: string }).code).toBe(
      'PROJECT_SCOPE_REQUIRED',
    );
    expect(stub).not.toHaveBeenCalled();
  });

  it('uses the HTTP pin when projectUuid is omitted', async () => {
    const createAgentThread = vi.fn().mockResolvedValue({ uuid: THREAD });
    const { handler } = registeredAiAgentTool(
      registerCreateAgentThread,
      mockAiAgentsContext({ createAgentThread }),
      'create_agent_thread',
    );
    await runWithProjectPinAsync(PROJECT, async () => {
      const result = await handler({ agentUuid: AGENT });
      expect(result.isError).toBeUndefined();
      expect(createAgentThread).toHaveBeenCalledWith(PROJECT, AGENT, {});
    });
  });

  it('blocks mismatched pin on generate', async () => {
    const generateAgentThreadResponse = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerGenerateAgentResponse,
      mockAiAgentsContext({ generateAgentThreadResponse }),
      'generate_agent_response',
    );
    await runWithProjectPinAsync(PROJECT, async () => {
      const result = await handler({
        projectUuid: OTHER,
        agentUuid: AGENT,
        threadUuid: THREAD,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('do not match the pinned project');
      expect(generateAgentThreadResponse).not.toHaveBeenCalled();
    });
  });

  it('blocks generate when the project is outside the allowlist', async () => {
    process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = OTHER;
    resetAvailableProjectsCache();
    const generateAgentThreadResponse = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerGenerateAgentResponse,
      mockAiAgentsContext({ generateAgentThreadResponse }),
      'generate_agent_response',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      threadUuid: THREAD,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('PROJECT_NOT_AVAILABLE');
    expect(generateAgentThreadResponse).not.toHaveBeenCalled();
  });

  it('does not put prompt text on the audit entry', async () => {
    const server = { registerTool: vi.fn() };
    bindServerProfile(server, 'ai-agent-chat');
    const createAgentThreadMessage = vi.fn().mockResolvedValue({ uuid: 'msg-1' });
    const { handler } = registeredAiAgentTool(
      registerCreateAgentThreadMessage,
      mockAiAgentsContext({ createAgentThreadMessage }),
      'create_agent_thread_message',
      server,
    );
    await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      threadUuid: THREAD,
      prompt: 'super-secret-user-prompt',
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'ai-agent-chat',
        tool: `${TOOL_PREFIX}create_agent_thread_message`,
        status: 'success',
        projectUuids: [PROJECT],
      }),
    );
    const entry = vi.mocked(logAuditEntry).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(entry)).not.toContain('super-secret-user-prompt');
    expect(entry).not.toHaveProperty('prompt');
    expect(entry).not.toHaveProperty('args');
  });
});
