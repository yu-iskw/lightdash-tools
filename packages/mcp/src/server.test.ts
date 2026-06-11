import { describe, expect, it } from 'vitest';

import { createLightdashMcpServer } from './server.js';
import { PACKAGE_VERSION } from './version.js';

import type { LightdashClient } from '@lightdash-tools/client';

describe('createLightdashMcpServer', () => {
  it('creates server with package version', () => {
    const client = {} as LightdashClient;
    const server = createLightdashMcpServer(client);
    expect(server).toBeDefined();
    expect(PACKAGE_VERSION).toBeTruthy();
  });
});
