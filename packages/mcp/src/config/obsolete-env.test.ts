import { afterEach, describe, expect, it } from 'vitest';

import { assertObsoleteEnvRejected } from './obsolete-env.js';

describe('assertObsoleteEnvRejected', () => {
  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_MCP_STDIO_PERSONA;
  });

  it('rejects LIGHTDASH_TOOLS_MCP_STDIO_PERSONA with ADR-0021 guidance', () => {
    process.env.LIGHTDASH_TOOLS_MCP_STDIO_PERSONA = 'semantic-layer';
    expect(() => assertObsoleteEnvRejected()).toThrow(/ADR-0021/);
    expect(() => assertObsoleteEnvRejected()).toThrow(/LIGHTDASH_TOOLS_MCP_STDIO_PROFILE/);
  });

  it('allows unset obsolete vars', () => {
    expect(() => assertObsoleteEnvRejected({})).not.toThrow();
  });
});
