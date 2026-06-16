import { describe, expect, it } from 'vitest';

import { createLightdashMcpServer } from './server.js';
import { listRegisteredToolNamesForTest } from './testing.js';
import { PACKAGE_VERSION } from './version.js';

describe('createLightdashMcpServer', () => {
  it('creates a bare server shell (no tools until registered)', async () => {
    const server = createLightdashMcpServer({ name: 'test-server', version: PACKAGE_VERSION });

    const toolNames = await listRegisteredToolNamesForTest(server);
    expect(toolNames).toEqual([]);
  });
});
