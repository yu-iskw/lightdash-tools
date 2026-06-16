import { describe, expect, it } from 'vitest';

import {
  extractTokenScopes,
  hasRequiredScopes,
  hasToolScope,
  requiredScopeForTool,
} from './token-scopes.js';

const SUPPORTED = ['read', 'write', 'mcp:read', 'mcp:write'] as const;

function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('extractTokenScopes', () => {
  it('reads space-delimited scope claim from JWT payloads', () => {
    const token = jwtWithPayload({ scope: 'mcp:read read' });
    expect(extractTokenScopes(token, SUPPORTED)).toEqual(['mcp:read', 'read']);
  });

  it('reads scp array claim from JWT payloads', () => {
    const token = jwtWithPayload({ scp: ['mcp:write', 'write', 'unknown'] });
    expect(extractTokenScopes(token, SUPPORTED)).toEqual(['mcp:write', 'write']);
  });

  it('returns undefined for opaque tokens by default', () => {
    expect(extractTokenScopes('opaque-token', SUPPORTED)).toBeUndefined();
  });

  it('returns undefined for JWTs without scope claims by default', () => {
    const token = jwtWithPayload({ sub: 'user-1' });
    expect(extractTokenScopes(token, SUPPORTED)).toBeUndefined();
  });

  it('returns an empty array when JWT scope claims are present but unsupported', () => {
    const token = jwtWithPayload({ scope: 'unknown-only' });
    expect(extractTokenScopes(token, SUPPORTED)).toEqual([]);
  });

  it('can grant all supported scopes for opaque tokens when explicitly opted in', () => {
    expect(extractTokenScopes('opaque-token', SUPPORTED, { grantAllWhenUnknown: true })).toEqual([
      ...SUPPORTED,
    ]);
  });
});

describe('hasRequiredScopes', () => {
  it('requires every configured scope', () => {
    expect(hasRequiredScopes(['mcp:read', 'mcp:write'], ['mcp:read'])).toBe(true);
    expect(hasRequiredScopes(['mcp:read'], ['mcp:read', 'mcp:write'])).toBe(false);
    expect(hasRequiredScopes([], ['mcp:read'])).toBe(false);
  });

  it('passes when no scopes are required', () => {
    expect(hasRequiredScopes([], [])).toBe(true);
    expect(hasRequiredScopes(undefined as unknown as string[], [])).toBe(true);
  });
});

describe('requiredScopeForTool', () => {
  it('maps read-only tools to mcp:read and writes to mcp:write', () => {
    expect(requiredScopeForTool(true)).toBe('mcp:read');
    expect(requiredScopeForTool(false)).toBe('mcp:write');
    expect(hasToolScope(['mcp:read'], true)).toBe(true);
    expect(hasToolScope(['mcp:read'], false)).toBe(false);
  });
});
