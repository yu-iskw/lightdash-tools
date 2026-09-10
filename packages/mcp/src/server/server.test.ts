import { describe, expect, it } from 'vitest';

import { usePreloadedProfiles } from '../profiles/test-support/preload-profiles.js';

import { createLightdashMcpServer } from './server.js';
import { PACKAGE_VERSION } from './version.js';

import type { McpContextProvider } from './request-context.js';

usePreloadedProfiles();

describe('createLightdashMcpServer', () => {
  it('creates server with package version', () => {
    const contextProvider = {
      getContext: async () => ({ lightdashClient: {} }),
    } as McpContextProvider;
    const server = createLightdashMcpServer(contextProvider);
    expect(server).toBeDefined();
    expect(PACKAGE_VERSION).toBeTruthy();
  });
});
