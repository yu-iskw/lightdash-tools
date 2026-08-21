import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS, logAuditEntry } from '@lightdash-tools/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import { resetAvailableProjectsCache } from '../../governance/available-projects.js';
import { runWithProjectPinAsync } from '../../governance/project-pin.js';
import { TOOL_PREFIX } from '../shared.js';

import { registerRouteAgent } from './router.js';
import {
  mockAiAgentsContext,
  parseAiAgentToolBody,
  registeredAiAgentTool,
} from './test-support.js';

vi.mock('@lightdash-tools/common', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest importOriginal
  const actual = await importOriginal<typeof import('@lightdash-tools/common')>();
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

describe('route_agent', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS];
    resetAvailableProjectsCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(logAuditEntry).mockClear();
  });

  it('posts the prompt to the AI Router for the resolved project', async () => {
    const decision = {
      nextAction: 'create_thread',
      decision: {
        candidates: [{ agentUuid: AGENT, name: 'Basic', description: null }],
        reasoning: 'generalist',
        confidence: 'high',
        suggestedAgentUuid: AGENT,
        decisionUuid: 'd1',
      },
    };
    const routeAiAgent = vi.fn().mockResolvedValue(decision);
    const { handler } = registeredAiAgentTool(
      registerRouteAgent,
      mockAiAgentsContext({ routeAiAgent }),
      'route_agent',
    );
    const result = await handler({ projectUuid: PROJECT, prompt: 'Explain this dashboard' });
    expect(result.isError).toBeUndefined();
    expect(routeAiAgent).toHaveBeenCalledWith({
      projectUuid: PROJECT,
      prompt: 'Explain this dashboard',
    });
    expect(parseAiAgentToolBody(result).data).toEqual(decision);
  });

  it('rejects empty prompts', async () => {
    const routeAiAgent = vi.fn();
    const { options } = registeredAiAgentTool(
      registerRouteAgent,
      mockAiAgentsContext({ routeAiAgent }),
      'route_agent',
    );
    const promptSchema = options.inputSchema.prompt as {
      safeParse: (v: unknown) => { success: boolean };
    };
    expect(promptSchema.safeParse('').success).toBe(false);
    expect(promptSchema.safeParse('  ').success).toBe(false);
  });

  it('blocks mismatched pin', async () => {
    const routeAiAgent = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerRouteAgent,
      mockAiAgentsContext({ routeAiAgent }),
      'route_agent',
    );
    await runWithProjectPinAsync(PROJECT, async () => {
      const result = await handler({ projectUuid: OTHER, prompt: 'route me' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('do not match the pinned project');
      expect(routeAiAgent).not.toHaveBeenCalled();
    });
  });

  it('blocks when the project is outside the allowlist', async () => {
    process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = OTHER;
    resetAvailableProjectsCache();
    const routeAiAgent = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerRouteAgent,
      mockAiAgentsContext({ routeAiAgent }),
      'route_agent',
    );
    const result = await handler({ projectUuid: PROJECT, prompt: 'route me' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('PROJECT_NOT_AVAILABLE');
    expect(routeAiAgent).not.toHaveBeenCalled();
  });

  it('does not put prompt text on the audit entry', async () => {
    const server = { registerTool: vi.fn() };
    bindServerProfile(server, 'ai-agent-chat');
    const routeAiAgent = vi.fn().mockResolvedValue({
      nextAction: 'create_thread',
      decision: {
        candidates: [],
        reasoning: 'x',
        confidence: 'high',
        suggestedAgentUuid: AGENT,
        decisionUuid: 'd1',
      },
    });
    const { handler } = registeredAiAgentTool(
      registerRouteAgent,
      mockAiAgentsContext({ routeAiAgent }),
      'route_agent',
      server,
    );
    await handler({ projectUuid: PROJECT, prompt: 'super-secret-route-prompt' });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'ai-agent-chat',
        tool: `${TOOL_PREFIX}route_agent`,
        status: 'success',
        projectUuids: [PROJECT],
      }),
    );
    const auditCall = vi.mocked(logAuditEntry).mock.calls[0];
    expect(JSON.stringify(auditCall)).not.toContain('super-secret-route-prompt');
  });
});
