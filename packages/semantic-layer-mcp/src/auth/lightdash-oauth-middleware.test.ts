import { describe, expect, it, vi } from 'vitest';

import { authenticateLightdashOAuth, writeOAuthAuthFailure } from './lightdash-oauth-middleware.js';
import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { TokenValidationError } from './token-validation-error.js';

import type { McpHttpConfig } from '../config/load-http-config.js';
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
  maxSessionsPerSubject: 10,
  sessionCleanupMs: 60_000,
  scopesSupported: [],
  validateToken: true,
  tokenValidationCacheTtlMs: 30_000,
  experimentalIdentityOAuth: false,
  dangerouslyAllowAnyOrigin: false,
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
    expect(JSON.stringify(result.body)).not.toContain(token);
  });

  it('returns success when validation passes', async () => {
    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-1',
      email: 'a@b.co',
      organizationUuid: 'org-1',
    });

    const result = await authenticateLightdashOAuth(createRequest('Bearer good-token'), baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accessToken).toBe('good-token');
    expect(result.user.userUuid).toBe('user-1');
  });

  it('writeOAuthAuthFailure sets WWW-Authenticate', () => {
    const headers: Record<string, string> = {};
    const res = {
      writeHead(_status: number, h: Record<string, string>) {
        Object.assign(headers, h);
        return res;
      },
      end() {
        return res;
      },
    } as unknown as ServerResponse;

    writeOAuthAuthFailure(res, {
      ok: false,
      status: 401,
      body: { error: 'invalid_request' },
      wwwAuthenticate:
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
    });

    expect(headers['WWW-Authenticate']).toContain('resource_metadata=');
  });
});
