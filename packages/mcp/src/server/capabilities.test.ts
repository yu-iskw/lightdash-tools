import { McpServer } from '@modelcontextprotocol/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getServerProfile } from '../audit/server-profile.js';
import { getDefaultProfile } from '../profiles/index.js';
import { registerToolsByIds } from '../tools/registry.js';

import { registerCapabilities } from './capabilities.js';

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

  it('registers catalog tools and prompts/resources for the profile', () => {
    const profile = getDefaultProfile();
    registerCapabilities(server, mockContextProvider, { profile });
    expect(getServerProfile(server)).toBe(profile.id);
    expect(registerToolsByIds).toHaveBeenCalledWith(
      server,
      mockContextProvider,
      profile.mcpToolNames,
    );
    expect(registerPromptSpy).toHaveBeenCalled();
    expect(registerResourceSpy).toHaveBeenCalled();
  });
});
