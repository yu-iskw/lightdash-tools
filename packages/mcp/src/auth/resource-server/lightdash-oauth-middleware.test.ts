import { SecretString } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestMcpHttpConfig } from '../../config/test-mcp-http-config.js';
import { ORGANIZATION_AUDIT_PROFILE_PATH } from '../../profiles/organization-audit/v1/index.js';
import { SEMANTIC_LAYER_PROFILE_PATH } from '../../profiles/semantic-layer/v1/index.js';
import { mintMcpAccessToken } from '../oauth-broker/mcp-access-token.js';

import { authenticateLightdashOAuth, writeOAuthAuthFailure } from './lightdash-oauth-middleware.js';
import { validateLightdashAccessToken } from './lightdash-token-validation.js';
import { TokenValidationError } from './token-validation-error.js';

import type { IncomingMessage, ServerResponse } from 'node:http';

vi.mock('./lightdash-token-validation.js', () => ({
  validateLightdashAccessToken: vi.fn(),
}));

const baseConfig = makeTestMcpHttpConfig({
  oauthClientId: 'ld-client',
  oauthClientSecret: new SecretString('test-lightdash-confidential-client-secret'),
  requiredScopes: [],
});

function createRequest(authorization?: string, headers?: Record<string, string>): IncomingMessage {
  return {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...headers,
    },
    socket: {},
  } as IncomingMessage;
}

function resourceFor(path: string): string {
  return `https://mcp.example.com${path}`;
}

function mcpToken(
  options: {
    path?: string;
    scope?: string;
    lightdashAccessToken?: string;
    expiresAtMs?: number;
  } = {},
): string {
  const path = options.path ?? SEMANTIC_LAYER_PROFILE_PATH;
  return mintMcpAccessToken(baseConfig, {
    lightdashAccessToken: options.lightdashAccessToken ?? 'ld-upstream-token',
    clientId: 'mcp-client-1',
    resource: resourceFor(path),
    scope: options.scope,
    expiresAtMs: options.expiresAtMs ?? Date.now() + 60_000,
  }).accessToken;
}

describe('authenticateLightdashOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 with WWW-Authenticate resource_metadata when token is missing', async () => {
    const result = await authenticateLightdashOAuth(
      createRequest(),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: 'invalid_request',
      error_description: 'Bearer access token required',
    });
    expect(result.wwwAuthenticate).toContain('resource_metadata=');
    expect(result.wwwAuthenticate).toContain(
      'https://mcp.example.com/.well-known/oauth-protected-resource/semantic-layer/v1/mcp',
    );
    expect(result.wwwAuthenticate).not.toContain('scope=');
  });

  it('points resource_metadata at the requested profile path', async () => {
    const result = await authenticateLightdashOAuth(
      createRequest(),
      baseConfig,
      ORGANIZATION_AUDIT_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.wwwAuthenticate).toContain(
      'https://mcp.example.com/.well-known/oauth-protected-resource/organization-audit/v1/mcp',
    );
    expect(result.wwwAuthenticate).not.toContain('semantic-layer/v1/mcp');
  });

  it('rejects a raw downstream Lightdash bearer before calling Lightdash', async () => {
    const token = 'ld-upstream-token';
    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${token}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.body.error).toBe('invalid_token');
    expect(JSON.stringify(result.body)).not.toContain(token);
    expect(validateLightdashAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a valid broker token at a different profile resource', async () => {
    const token = mcpToken({ path: ORGANIZATION_AUDIT_PROFILE_PATH });
    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${token}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.body.error_description).toContain('wrong-audience');
    expect(validateLightdashAccessToken).not.toHaveBeenCalled();
  });

  it('returns 401 without echoing the MCP bearer when downstream validation fails', async () => {
    vi.mocked(validateLightdashAccessToken).mockRejectedValue(
      new TokenValidationError('invalid_token', 'Invalid or expired Lightdash access token'),
    );

    const token = mcpToken();
    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${token}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(401);
    expect(result.body.error).toBe('invalid_token');
    expect(JSON.stringify(result.body)).not.toContain(token);
    expect(result.wwwAuthenticate).toContain('error="invalid_token"');
    expect(validateLightdashAccessToken).toHaveBeenCalledWith(baseConfig, 'ld-upstream-token');
  });

  it('returns 503 when Lightdash upstream is unavailable', async () => {
    vi.mocked(validateLightdashAccessToken).mockRejectedValue(
      new TokenValidationError('upstream_unavailable', 'Lightdash is temporarily unavailable'),
    );

    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${mcpToken()}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

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

    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${mcpToken()}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(503);
    expect(result.headers).toEqual({ 'Retry-After': '60' });
  });

  it('returns downstream user context only after broker-token validation succeeds', async () => {
    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
    });

    const token = mcpToken({ scope: 'mcp:read mcp:write' });
    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${token}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result).toEqual({
      ok: true,
      accessToken: 'ld-upstream-token',
      user: { userUuid: 'user-uuid-1', email: 'user@example.com' },
      scopes: ['mcp:read', 'mcp:write'],
    });
    expect(validateLightdashAccessToken).toHaveBeenCalledWith(baseConfig, 'ld-upstream-token');
  });

  it('accepts an MCP token without scopes when endpoint scope requirements are unset', async () => {
    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
    });

    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${mcpToken()}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scopes).toBeUndefined();
  });

  it('returns 403 insufficient_scope before calling Lightdash when MCP scopes are missing', async () => {
    const scopedConfig = { ...baseConfig, requiredScopes: ['mcp:read'] };
    const token = mcpToken({ scope: 'mcp:write' });
    const result = await authenticateLightdashOAuth(
      createRequest(`Bearer ${token}`),
      scopedConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.status).toBe(403);
    expect(result.body.error).toBe('insufficient_scope');
    expect(result.wwwAuthenticate).toContain('error="insufficient_scope"');
    expect(result.wwwAuthenticate).toContain('scope="mcp:read"');
    expect(validateLightdashAccessToken).not.toHaveBeenCalled();
  });

  it('accepts lowercase bearer scheme prefix', async () => {
    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
    });

    const result = await authenticateLightdashOAuth(
      createRequest(`bearer ${mcpToken()}`),
      baseConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accessToken).toBe('ld-upstream-token');
  });

  it('challenges and verifies against an extra invoke-origin resource when Host matches', async () => {
    const invokeOrigin = new URL('http://mcp.ilb.internal');
    const invokeConfig = makeTestMcpHttpConfig({
      oauthClientId: 'ld-client',
      oauthClientSecret: new SecretString('test-lightdash-confidential-client-secret'),
      requiredScopes: [],
      invokeOrigins: [invokeOrigin],
    });
    const invokeHeaders = {
      host: 'mcp.ilb.internal',
      'x-forwarded-proto': 'http',
    };
    const invokeResource = `http://mcp.ilb.internal${SEMANTIC_LAYER_PROFILE_PATH}`;

    const challenge = await authenticateLightdashOAuth(
      createRequest(undefined, invokeHeaders),
      invokeConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );
    expect(challenge.ok).toBe(false);
    if (challenge.ok) return;
    expect(challenge.wwwAuthenticate).toContain(
      'http://mcp.ilb.internal/.well-known/oauth-protected-resource/semantic-layer/v1/mcp',
    );

    vi.mocked(validateLightdashAccessToken).mockResolvedValue({
      userUuid: 'user-1',
      email: 'user@example.com',
    });

    const invokeToken = mintMcpAccessToken(invokeConfig, {
      lightdashAccessToken: 'ld-upstream-token',
      clientId: 'mcp-client-1',
      resource: invokeResource,
      expiresAtMs: Date.now() + 60_000,
    }).accessToken;

    const ok = await authenticateLightdashOAuth(
      createRequest(`Bearer ${invokeToken}`, invokeHeaders),
      invokeConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );
    expect(ok.ok).toBe(true);

    const publicHostRejectsInvokeToken = await authenticateLightdashOAuth(
      createRequest(`Bearer ${invokeToken}`, { host: 'mcp.example.com' }),
      invokeConfig,
      SEMANTIC_LAYER_PROFILE_PATH,
    );
    expect(publicHostRejectsInvokeToken.ok).toBe(false);
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
