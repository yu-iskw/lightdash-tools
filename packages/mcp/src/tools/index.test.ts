import { SafetyMode } from '@lightdash-tools/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { setStaticSafetyMode, setDryRunMode } from '../config.js';

import { TOOL_PREFIX } from './shared.js';

import { registerTools } from './index.js';

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

describe('registerTools', () => {
  const registeredTools: Array<{ name: string; description: string }> = [];
  const mockServer = {
    registerTool: vi.fn((name: string, options: { description: string }) => {
      registeredTools.push({ name, description: options.description });
    }),
  };

  beforeEach(() => {
    registeredTools.length = 0;
    mockServer.registerTool.mockClear();
    setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE);
    setDryRunMode(false);
    process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
    delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  it('registers all domain tool modules on the MCP server', () => {
    const mockClient = {} as never;

    registerTools(mockServer as never, mockClient);

    expect(registeredTools.length).toBeGreaterThan(30);
    expect(registeredTools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);

    const names = registeredTools.map((t) => t.name);
    expect(names).toContain(`${TOOL_PREFIX}list_projects`);
    expect(names).toContain(`${TOOL_PREFIX}list_charts`);
    expect(names).toContain(`${TOOL_PREFIX}compile_query`);
    expect(names).toContain(`${TOOL_PREFIX}list_admin_agents`);
    expect(names).toContain(`${TOOL_PREFIX}ai_agentops_plan`);
    expect(names).toContain(`${TOOL_PREFIX}ai_agentops_apply`);
    expect(names).toContain(`${TOOL_PREFIX}ai_agentops_evaluate_gate`);
  });
});
