import { describe, expect, it, vi } from 'vitest';

import { authenticateLightdashOAuth, writeOAuthAuthFailure } from './lightdash-oauth-middleware.js';
import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { TokenValidationError } from './token-validation-error.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

vi.mock('./lightdash-token-validation.js', () => ({
  validateLightdashAccessToken: vi.fn(),
}));

const baseConfig: McpHttpConfig = {
  lightdashUrl: 'https://app.lightdash.cloud',
  host: '127.0.0.1',
  port: 3100,
  publicUrl: 'https://mcp.example.com',
  mcpPath: '/mcp',
  authMode: 'lightdash-oauth',
  allowedOrigins: [],
  maxBodyBytes: 1024,
  sessionTtlMs: 60_000,
  maxSessions: 10,
  sessionCleanupMs: 60_000,
  requiredScopes: ['mcp:read'],
  scopesSupported: ['mcp:read', 'mcp:write'],
  validateToken: true,
  tokenValidationCacheTtlMs: 30_000,
};

function createRequest(authorization?: string): IncomingMessage {
  return {
    headers: authorization ? { authorization } : {},
  } as IncomingMessage;
}

describe('authenticateLightdashOAuth', () => {
  it('returns 401 with WWW-Authenticate resource_metadata when token is missing', async () => {
    const result = await authenticateLightdashOAuth(createRequest(), baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: 'invalid_request',
      error_description: 'Bearer access token required',
    });
    expect(result.wwwAuthenticate).toContain('resource_metadata=');
    expect(result.wwwAuthenticate).toContain(
      'https://mcp.example.com/.well-known/oauth-protected-resource/mcp',
    );
    expect(result.wwwAuthenticate).toContain('scope="mcp:read"');
  });

  it('returns 401 without echoing the bearer token when validation fails', async () => {
    vi.mocked(validateLightdashAccessToken).mockRejectedValue(
      new TokenValidationError('invalid_token', 'Invalid or expired Lightdash access token'),
    );

    const token = 'secret-oauth-token';
    const result = await authenticateLightdashOAuth(createRequest(`Bearer ${token}`), baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(401);
    expect(result.body.error).toBe('invalid_token');
    expect(result.body.error_description).toBe('Invalid or expired Lightdash access token');
    expect(JSON.stringify(result.body)).not.toContain(token);
    expect(result.wwwAuthenticate).toContain('error="invalid_token"');
  });

  it('returns 503 when Lightdash upstream is unavailable', async () => {
    vi.mocked(validateLightdashAccessToken).mockRejectedValue(
      new TokenValidationError('upstream_unavailable', 'Lightdash is temporarily unavailable'),
    );

    const result = await authenticateLightdashOAuth(createRequest('Bearer token'), baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      error: 'temporarily_unavailable',
      error_description: 'Lightdash is temporarily unavailable',
    });
    expect(result.wwwAuthenticate).toBeUndefined();
  });

  it('returns 503 with Retry-After when upstream is rate limited', async () => {
    vi.mocked(validateLightdashAccessToken).mockRejectedValue(
      new TokenValidationError('upstream_unavailable', 'Lightdash is temporarily unavailable', 60),
    );

    const result = await authenticateLightdashOAuth(createRequest('Bearer token'), baseConfig);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(503);
    expect(result.headers).toEqual({ 'Retry-After': '60' });
  });

  it('returns user context when token validation succeeds', async () => {
    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
    });

    const token = 'valid-token';
    const result = await authenticateLightdashOAuth(createRequest(`Bearer ${token}`), baseConfig);

    expect(result).toEqual({
      ok: true,
      accessToken: token,
      user: { userUuid: 'user-uuid-1', email: 'user@example.com' },
    });
    expect(validateLightdashAccessToken).toHaveBeenCalledWith(baseConfig, token);
  });
});

describe('writeOAuthAuthFailure', () => {
  it('writes JSON body and WWW-Authenticate header', () => {
    const chunks: string[] = [];
    const res = {
      writeHead: vi.fn(function (this: ServerResponse, _status: number) {
        return this;
      }),
      end: vi.fn(function (this: ServerResponse, chunk?: string) {
        if (chunk) chunks.push(chunk);
        return this;
      }),
    } as unknown as ServerResponse;

    writeOAuthAuthFailure(res, {
      ok: false,
      status: 401,
      body: {
        error: 'invalid_request',
        error_description: 'Bearer access token required',
      },
      wwwAuthenticate:
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    });

    expect(res.writeHead).toHaveBeenCalledWith(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate':
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    });
    expect(JSON.parse(chunks[0] ?? '{}')).toEqual({
      error: 'invalid_request',
      error_description: 'Bearer access token required',
    });
  });
});
