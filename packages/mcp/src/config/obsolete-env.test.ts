import { afterEach, describe, expect, it } from 'vitest';

import { ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE, ENV_LIGHTDASH_TOOLS_MCP_STDIO_PERSONA } from './env.js';
import { assertObsoleteEnvRejected } from './obsolete-env.js';

describe('assertObsoleteEnvRejected', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE];
    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_STDIO_PERSONA];
  });

  it('rejects obsolete AUTH_MODE env', () => {
    process.env[ENV_LIGHTDASH_TOOLS_MCP_AUTH_MODE] = 'lightdash-oauth';
    expect(() => assertObsoleteEnvRejected()).toThrow(/is removed/);
  });

  it('allows unset obsolete vars', () => {
    expect(() => assertObsoleteEnvRejected({})).not.toThrow();
  });

  it('rejects obsolete STDIO_PERSONA env', () => {
    process.env[ENV_LIGHTDASH_TOOLS_MCP_STDIO_PERSONA] = 'semantic-layer';
    expect(() => assertObsoleteEnvRejected()).toThrow(/STDIO_PROFILE/);
  });
});
