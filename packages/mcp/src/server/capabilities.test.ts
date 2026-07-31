import { McpServer } from '@modelcontextprotocol/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { registerCapabilities } from './capabilities.js';
import { getDefaultPersona } from '../personas/index.js';
import { registerToolsByIds } from '../tools/registry.js';

vi.mock('../tools/registry.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest importOriginal
  const actual = await importOriginal<typeof import('../tools/registry.js')>();
  return {
    ...actual,
    registerToolsByIds: vi.fn(),
  };
});

import type { McpContextProvider } from './request-context.js';

function createMockContextProvider(lightdashClient: object = {}): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: lightdashClient as never,
      auth: { mode: 'env' as const },
    }),
  };
}

describe('registerCapabilities', () => {
  const mockContextProvider = createMockContextProvider();
  let server: McpServer;
  let registerPromptSpy: ReturnType<typeof vi.spyOn>;
  let registerResourceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerPromptSpy = vi.spyOn(server, 'registerPrompt');
    registerResourceSpy = vi.spyOn(server, 'registerResource');
    vi.mocked(registerToolsByIds).mockClear();
  });

  it('registers persona tool allowlist and prompts/resources', () => {
    const persona = getDefaultPersona();
    registerCapabilities(server, mockContextProvider, { persona });
    expect(registerToolsByIds).toHaveBeenCalledWith(server, mockContextProvider, persona.toolIds);
    expect(registerPromptSpy).toHaveBeenCalled();
    expect(registerResourceSpy).toHaveBeenCalled();
  });
});
