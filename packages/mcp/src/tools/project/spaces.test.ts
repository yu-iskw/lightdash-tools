import { describe, expect, it, vi } from 'vitest';

import { bindServerPersona } from '../../audit/server-persona.js';

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

describe('registerListSpaces persona envelope', () => {
  it('stamps content-developer when server persona is bound', async () => {
    const listSpacesInProject = vi
      .fn()
      .mockResolvedValue([{ uuid: 'space-1', name: 'Root', slug: 'root', parentSpaceUuid: null }]);
    const mockServer = { registerTool: vi.fn() };
    bindServerPersona(mockServer, 'content-developer');
    registerListSpaces(mockServer as never, mockContext(listSpacesInProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PROJECT });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text) as {
      context: { persona: string; projectUuid: string };
    };
    expect(body.context.persona).toBe('content-developer');
    expect(body.context.projectUuid).toBe(PROJECT);
  });

  it('stamps content-reader when server persona is bound', async () => {
    const listSpacesInProject = vi.fn().mockResolvedValue([]);
    const mockServer = { registerTool: vi.fn() };
    bindServerPersona(mockServer, 'content-reader');
    registerListSpaces(mockServer as never, mockContext(listSpacesInProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PROJECT });
    const body = JSON.parse(result.content[0].text) as { context: { persona: string } };
    expect(body.context.persona).toBe('content-reader');
  });

  it('throws when server persona is unbound at registration', () => {
    const mockServer = { registerTool: vi.fn() };
    expect(() => registerListSpaces(mockServer as never, mockContext(vi.fn()))).toThrow(
      'personaId is required to register list_spaces',
    );
    expect(mockServer.registerTool).not.toHaveBeenCalled();
  });
});
