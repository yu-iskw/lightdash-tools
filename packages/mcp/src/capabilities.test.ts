import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  MCP_PROFILE_CORE_LIFECYCLE,
  MCP_PROFILE_EVALUATIONS,
  getMcpProfiles,
} from './config.js';
import { registerCapabilities } from './capabilities.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';
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

describe('registerCapabilities', () => {
  const mockClient = {} as never;
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
    registerCapabilities(server, mockClient);
    expect(registerTools).toHaveBeenCalledWith(server, mockClient);
  });

  it('registers resources and prompts for default profiles', () => {
    registerCapabilities(server, mockClient);
    expect(registerResources).toHaveBeenCalledWith(server, mockClient);
    expect(registerPrompts).toHaveBeenCalledWith(
      server,
      mockClient,
      getMcpProfiles(),
    );
  });

  it('skips resources when evaluations profile is disabled', () => {
    registerCapabilities(server, mockClient, {
      profiles: new Set([MCP_PROFILE_CORE_LIFECYCLE]),
    });
    expect(registerResources).not.toHaveBeenCalled();
    expect(registerPrompts).toHaveBeenCalled();
  });

  it('skips prompts when both lifecycle profiles are disabled', () => {
    registerCapabilities(server, mockClient, { profiles: new Set() });
    expect(registerPrompts).not.toHaveBeenCalled();
    expect(registerResources).not.toHaveBeenCalled();
  });

  it('registers evaluation prompts only for evaluations profile', () => {
    registerCapabilities(server, mockClient, {
      profiles: new Set([MCP_PROFILE_EVALUATIONS]),
    });
    expect(registerResources).toHaveBeenCalled();
    expect(registerPrompts).toHaveBeenCalledWith(
      server,
      mockClient,
      new Set([MCP_PROFILE_EVALUATIONS]),
    );
  });
});
