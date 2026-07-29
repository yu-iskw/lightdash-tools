import { SafetyMode } from '@lightdash-tools/common';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { registerCapabilities } from './capabilities.js';
import { MCP_PROFILE_CORE_LIFECYCLE, MCP_PROFILE_EVALUATIONS, getMcpProfiles } from './config.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';

vi.mock('./tools/index.js', () => ({
  registerTools: vi.fn(),
}));

vi.mock('./resources/index.js', () => ({
  registerResources: vi.fn(),
}));

vi.mock('./prompts/index.js', () => ({
  registerPrompts: vi.fn(),
}));

import type { McpContextProvider } from './request-context.js';

function createMockContextProvider(lightdashClient: object = {}): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: lightdashClient as never,
      auth: { mode: 'env' as const },
      governance: {
        safetyMode: SafetyMode.READ_ONLY,
        dryRun: false,
        allowedProjectUuids: [],
      },
    }),
  };
}

describe('registerCapabilities', () => {
  const mockContextProvider = createMockContextProvider();
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    vi.mocked(registerTools).mockClear();
    vi.mocked(registerResources).mockClear();
    vi.mocked(registerPrompts).mockClear();
    delete process.env.LIGHTDASH_TOOLS_MCP_PROFILES;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_MCP_PROFILES;
  });

  it('always registers tools', () => {
    registerCapabilities(server, mockContextProvider);
    expect(registerTools).toHaveBeenCalledWith(server, mockContextProvider);
  });

  it('registers resources and prompts for default profiles', () => {
    registerCapabilities(server, mockContextProvider);
    expect(registerResources).toHaveBeenCalledWith(server, mockContextProvider);
    expect(registerPrompts).toHaveBeenCalledWith(server, mockContextProvider, getMcpProfiles());
  });

  it('skips resources when evaluations profile is disabled', () => {
    registerCapabilities(server, mockContextProvider, {
      profiles: new Set([MCP_PROFILE_CORE_LIFECYCLE]),
    });
    expect(registerResources).not.toHaveBeenCalled();
    expect(registerPrompts).toHaveBeenCalled();
  });

  it('skips prompts when both lifecycle profiles are disabled', () => {
    registerCapabilities(server, mockContextProvider, { profiles: new Set() });
    expect(registerPrompts).not.toHaveBeenCalled();
    expect(registerResources).not.toHaveBeenCalled();
  });

  it('registers evaluation prompts only for evaluations profile', () => {
    registerCapabilities(server, mockContextProvider, {
      profiles: new Set([MCP_PROFILE_EVALUATIONS]),
    });
    expect(registerResources).toHaveBeenCalled();
    expect(registerPrompts).toHaveBeenCalledWith(
      server,
      mockContextProvider,
      new Set([MCP_PROFILE_EVALUATIONS]),
    );
  });
});
