import { describe, expect, it } from 'vitest';

import { normalizeMcpPath, normalizePublicUrl } from './normalize-url.js';

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

describe('normalizePublicUrl', () => {
  it('strips the default /mcp suffix', () => {
    expect(normalizePublicUrl('https://mcp.example.com/mcp/')).toBe('https://mcp.example.com');
  });

  it('strips a configured custom MCP path suffix', () => {
    expect(normalizePublicUrl('https://mcp.example.com/custom/mcp', '/custom/mcp')).toBe(
      'https://mcp.example.com',
    );
  });

  it('leaves origin-only URLs unchanged', () => {
    expect(normalizePublicUrl('https://mcp.example.com', '/custom/mcp')).toBe(
      'https://mcp.example.com',
    );
  });
});
