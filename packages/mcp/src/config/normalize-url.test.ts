import { describe, expect, it } from 'vitest';

import { CONTENT_READER_PERSONA_PATH } from '../personas/content-reader/v1/index.js';
import { ORGANIZATION_AUDIT_PERSONA_PATH } from '../personas/organization-audit/v1/index.js';
import { SEMANTIC_LAYER_PERSONA_PATH } from '../personas/semantic-layer/v1/index.js';

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
  it('strips a configured MCP path suffix', () => {
    expect(normalizePublicUrl('https://mcp.example.com/mcp/', ['/mcp'])).toBe(
      'https://mcp.example.com',
    );
  });

  it('strips a configured custom MCP path suffix', () => {
    expect(normalizePublicUrl('https://mcp.example.com/custom/mcp', ['/custom/mcp'])).toBe(
      'https://mcp.example.com',
    );
  });

  it('leaves origin-only URLs unchanged', () => {
    expect(normalizePublicUrl('https://mcp.example.com', ['/custom/mcp'])).toBe(
      'https://mcp.example.com',
    );
  });

  it('strips the semantic-layer persona path', () => {
    expect(
      normalizePublicUrl(`https://mcp.example.com${SEMANTIC_LAYER_PERSONA_PATH}/`, [
        SEMANTIC_LAYER_PERSONA_PATH,
      ]),
    ).toBe('https://mcp.example.com');
  });

  it('strips any known persona path when given a path list', () => {
    const paths = [
      SEMANTIC_LAYER_PERSONA_PATH,
      ORGANIZATION_AUDIT_PERSONA_PATH,
      CONTENT_READER_PERSONA_PATH,
    ];
    expect(
      normalizePublicUrl(`https://mcp.example.com${ORGANIZATION_AUDIT_PERSONA_PATH}`, paths),
    ).toBe('https://mcp.example.com');
    expect(
      normalizePublicUrl(`https://mcp.example.com${SEMANTIC_LAYER_PERSONA_PATH}/`, paths),
    ).toBe('https://mcp.example.com');
    expect(normalizePublicUrl(`https://mcp.example.com${CONTENT_READER_PERSONA_PATH}`, paths)).toBe(
      'https://mcp.example.com',
    );
  });
});
