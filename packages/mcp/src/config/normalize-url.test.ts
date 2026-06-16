import { describe, expect, it } from 'vitest';

import { normalizeMcpPath } from './normalize-url.js';

describe('normalizeMcpPath', () => {
  it('adds a leading slash when missing', () => {
    expect(normalizeMcpPath('mcp')).toBe('/mcp');
  });

  it('removes trailing slashes', () => {
    expect(normalizeMcpPath('/mcp/')).toBe('/mcp');
  });

  it('preserves custom nested paths', () => {
    expect(normalizeMcpPath('/custom/mcp')).toBe('/custom/mcp');
  });

  it('rejects empty paths', () => {
    expect(() => normalizeMcpPath('   ')).toThrow(/must not be empty/);
  });
});
