import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

import { registerCapabilities } from './capabilities.js';

import type { McpContextProvider } from './request-context.js';

describe('registerCapabilities', () => {
  it('always registers prompts and resources', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    const registerPromptSpy = vi.spyOn(server, 'registerPrompt');
    const registerResourceSpy = vi.spyOn(server, 'registerResource');
    const contextProvider = {
      getContext: async () => {
        throw new Error('unused');
      },
    } satisfies McpContextProvider;

    registerCapabilities(server, contextProvider);

    expect(registerPromptSpy).toHaveBeenCalledTimes(3);
    expect(registerResourceSpy).toHaveBeenCalledTimes(1);
  });
});
