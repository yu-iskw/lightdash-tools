import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getDefaultPersona } from '../personas/index.js';

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

  it('registers only the persona allowlist with lightdash_ prefix', () => {
    const mockContextProvider = { getContext: async () => ({ lightdashClient: {} }) };
    const persona = getDefaultPersona();

    registerToolsByIds(mockServer as never, mockContextProvider as never, persona.toolIds);

    expect(registeredTools).toHaveLength(persona.toolIds.length);
    expect(registeredTools.every((t) => t.name.startsWith(TOOL_PREFIX))).toBe(true);

    const names = registeredTools.map((t) => t.name);
    expect(names).toEqual(persona.toolIds.map((id) => `${TOOL_PREFIX}${id}`));
  });

  it('covers every registry tool id via some persona allowlist', async () => {
    const { PERSONAS } = await import('../personas/index.js');
    const { toolRegistry } = await import('./registry.js');
    const covered = new Set(Object.values(PERSONAS).flatMap((p) => [...p.toolIds]));
    expect([...covered].sort()).toEqual(Object.keys(toolRegistry).sort());
  });
});
