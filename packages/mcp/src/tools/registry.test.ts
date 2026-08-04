import { describe, it, expect, vi, beforeEach } from 'vitest';

import { bindServerProfile } from '../audit/server-profile.js';
import { getDefaultProfile, listToolIds } from '../profiles/index.js';

import { registerTools } from './registry.js';
import { TOOL_PREFIX } from './shared.js';

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
    registerResource: vi.fn(),
  };

  beforeEach(() => {
    registeredTools.length = 0;
    mockServer.registerTool.mockClear();
  });

  it('registers only the profile tools with lightdash_ prefix', () => {
    const mockContextProvider = { getContext: async () => ({ lightdashClient: {} }) };
    const profile = getDefaultProfile();
    const toolIds = listToolIds(profile);

    bindServerProfile(mockServer, profile.id);
    registerTools(mockServer as never, mockContextProvider as never, profile.tools);

    expect(registeredTools).toHaveLength(toolIds.length);
    expect(registeredTools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);

    const names = registeredTools.map((t) => t.name);
    expect(names).toEqual(toolIds.map((id) => `${TOOL_PREFIX}${id}`));
  });
});
