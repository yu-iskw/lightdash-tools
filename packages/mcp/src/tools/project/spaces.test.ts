import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';

import { registerListSpaces } from './spaces.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PROJECT = '3dda11cb-aac8-42f7-82f1-26fa6b1afa80';

function mockContext(listSpacesInProject: ReturnType<typeof vi.fn>): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {
        v1: { spaces: { listSpacesInProject } },
      },
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

describe('registerListSpaces profile envelope', () => {
  it('stamps content-developer when server profile is bound', async () => {
    const listSpacesInProject = vi
      .fn()
      .mockResolvedValue([{ uuid: 'space-1', name: 'Root', slug: 'root', parentSpaceUuid: null }]);
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-developer');
    registerListSpaces(mockServer as never, mockContext(listSpacesInProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PROJECT });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text) as {
      context: { profile: string; projectUuid: string };
    };
    expect(body.context.profile).toBe('content-developer');
    expect(body.context.projectUuid).toBe(PROJECT);
  });

  it('stamps content-reader when server profile is bound', async () => {
    const listSpacesInProject = vi.fn().mockResolvedValue([]);
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerListSpaces(mockServer as never, mockContext(listSpacesInProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PROJECT });
    const body = JSON.parse(result.content[0].text) as { context: { profile: string } };
    expect(body.context.profile).toBe('content-reader');
  });

  it('throws when server profile is unbound at registration', () => {
    const mockServer = { registerTool: vi.fn() };
    expect(() => registerListSpaces(mockServer as never, mockContext(vi.fn()))).toThrow(
      'profileId is required to register list_spaces',
    );
    expect(mockServer.registerTool).not.toHaveBeenCalled();
  });
});
