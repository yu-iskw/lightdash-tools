import { listMcpToolNamesByProfile } from '@lightdash-tools/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { bindServerProfile } from '../audit/server-profile.js';
import { getDefaultProfile } from '../profiles/index.js';

import { registerToolsByIds } from './registry.js';
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

describe('registerToolsByIds', () => {
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

  it('registers only the profile catalog tools with lightdash_ prefix', () => {
    const mockContextProvider = { getContext: async () => ({ lightdashClient: {} }) };
    const profile = getDefaultProfile();
    const toolIds = listMcpToolNamesByProfile(profile.id);

    bindServerProfile(mockServer, profile.id);
    registerToolsByIds(mockServer as never, mockContextProvider as never, toolIds);

    expect(registeredTools).toHaveLength(toolIds.length);
    expect(registeredTools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);

    const names = registeredTools.map((t) => t.name);
    expect(names).toEqual(toolIds.map((id) => `${TOOL_PREFIX}${id}`));
  });

  it('covers every registry tool id via some profile membership', async () => {
    const { PROFILES } = await import('../profiles/index.js');
    const { toolRegistry } = await import('./registry.js');
    const covered = new Set(
      Object.keys(PROFILES).flatMap((id) => listMcpToolNamesByProfile(id as keyof typeof PROFILES)),
    );
    for (const id of Object.keys(toolRegistry)) {
      expect(covered.has(id), `uncovered tool ${id}`).toBe(true);
    }
  });
});
