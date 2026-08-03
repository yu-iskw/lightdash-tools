import { createServer, type Server } from 'node:http';

import { SecretString } from '@lightdash-tools/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthorizationServerMetadataUrl } from './auth/resource-server/oauth-protected-resource.js';
import { resetClientCapabilitiesCacheForTests } from './governance/client-capabilities-cache.js';
import { createStreamableHttpServer } from './transports/streamable-http.js';

import type { McpHttpConfig } from './config/load-mcp-config.js';
import type { AddressInfo } from 'node:net';

const TOKEN_A = scopedAccessToken('mcp:read mcp:write', 'token-a');
const TOKEN_B = scopedAccessToken('mcp:read mcp:write', 'token-b');
const TOKEN_READ_ONLY = scopedAccessToken('mcp:read', 'token-read-only');
const OPAQUE_TOKEN_A = 'opaque-token-user-a';

const USER_A = { userUuid: 'user-a-uuid', email: 'a@example.com', organizationUuid: 'org-a-uuid' };
const USER_B = { userUuid: 'user-b-uuid', email: 'b@example.com', organizationUuid: 'org-b-uuid' };

function scopedAccessToken(scope: string, subject: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ scope, sub: subject })).toString('base64url');
  return `${header}.${payload}.signature`;
}

const INITIALIZE_BODY = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'integration-test', version: '1.0.0' },
  },
  id: 1,
};

interface MockLightdashServer {
  baseUrl: string;
  authorizationHeaders: string[];
  close: () => Promise<void>;
}

interface McpHttpServer {
  baseUrl: string;
  close: () => Promise<void>;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

async function startMockLightdashServer(): Promise<MockLightdashServer> {
  const authorizationHeaders: string[] = [];
  const users: Record<string, { userUuid: string; email: string; organizationUuid?: string }> = {
    [TOKEN_A]: USER_A,
    [TOKEN_B]: USER_B,
    [TOKEN_READ_ONLY]: USER_A,
    [OPAQUE_TOKEN_A]: USER_A,
  };

  let issuerBaseUrl = '';

  const server = createServer((req, res) => {
    const authHeader = req.headers.authorization;
    const auth = typeof authHeader === 'string' ? authHeader : (authHeader?.[0] ?? '');
    authorizationHeaders.push(auth);

    if (req.method === 'GET' && req.url === '/.well-known/oauth-authorization-server') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          issuer: issuerBaseUrl,
          authorization_endpoint: `${issuerBaseUrl}/api/v1/oauth/authorize`,
          token_endpoint: `${issuerBaseUrl}/api/v1/oauth/token`,
          revocation_endpoint: `${issuerBaseUrl}/api/v1/oauth/revoke`,
          registration_endpoint: `${issuerBaseUrl}/api/v1/oauth/register`,
          userinfo_endpoint: `${issuerBaseUrl}/api/v1/oauth/userinfo`,
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/api/v1/user') {
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
      const user = users[token];
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'error',
            error: { statusCode: 401, name: 'Unauthorized', message: 'Invalid token' },
          }),
        );
        return;
      }

      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ok', results: user }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/v1/org/projects') {
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
      if (!users[token]) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'error',
            error: { statusCode: 401, name: 'Unauthorized', message: 'Invalid token' },
          }),
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'ok',
          results: [
            {
              projectUuid: 'project-a-uuid',
              name: 'Project A',
              type: 'DEFAULT',
            },
          ],
        }),
      );
      return;
    }

    res.writeHead(404).end();
  });

  await listen(server, 0, '127.0.0.1');
  const address = server.address() as AddressInfo;
  issuerBaseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl: issuerBaseUrl,
    authorizationHeaders,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

function baseOAuthConfig(lightdashUrl: string): McpHttpConfig {
  return {
    lightdashUrl,
    host: '127.0.0.1',
    port: 0,
    publicUrl: 'http://127.0.0.1:0',
    mcpPath: '/semantic-layer/v1/mcp',
    authMode: 'lightdash-oauth',
    oauthClientId: 'test-client-id',
    oauthClientSecret: new SecretString('test-client-secret'),
    allowedOrigins: [],
    maxBodyBytes: 1024 * 1024,
    requiredScopes: [],
    scopesSupported: [],
    validateToken: true,
    tokenValidationCacheTtlMs: 30_000,
  };
}

async function postMcp(
  baseUrl: string,
  body: unknown,
  options?: { token?: string; path?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const path = options?.path ?? '/semantic-layer/v1/mcp';
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function parseSseOrJsonToolText(raw: string): string {
  if (raw.includes('data:')) {
    const lines = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim());
    return lines.join('\n');
  }
  return raw;
}

describe('MCP HTTP OAuth integration (RFC §16.3 matrix)', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl),
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    resetClientCapabilitiesCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns 401 with WWW-Authenticate resource_metadata when OAuth token is missing', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY);

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get('www-authenticate');
    expect(wwwAuthenticate).toContain('resource_metadata=');
    expect(wwwAuthenticate).toContain(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/semantic-layer/v1/mcp`,
    );
  });

  it('returns 401 without echoing invalid bearer token in response body', async () => {
    const invalidToken = 'not-a-valid-token';
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: invalidToken });

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(invalidToken);
    expect(response.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('handles initialize with valid OAuth bearer and validates upstream Authorization', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });

    expect(response.status).toBe(200);
    // Sessionless: no session-id header is set
    expect(response.headers.get('mcp-session-id')).toBeFalsy();
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
  });

  it('returns 401 before parsing malformed JSON when OAuth token is missing', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: '{not-json',
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('returns 401 invalid_token for invalid bearer before accepting valid JSON', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: 'not-a-valid-token',
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('returns 400 for malformed JSON only after successful OAuth authentication', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN_A}`,
      },
      body: '{not-json',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Bad Request: invalid JSON body' });
  });

  it('serves OAuth protected resource metadata at /.well-known/oauth-protected-resource', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata).toEqual({
      resource: `${mcpServer.baseUrl}/semantic-layer/v1/mcp`,
      authorization_servers: [mcpServer.baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: [],
    });
  });

  it('serves path-specific OAuth protected resource metadata', async () => {
    const response = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/semantic-layer/v1/mcp`,
    );

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`);
  });

  it('serves organization-audit path-specific OAuth protected resource metadata', async () => {
    const response = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/organization-audit/v1/mcp`,
    );

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/organization-audit/v1/mcp`);
  });

  it('serves content-reader path-specific OAuth protected resource metadata', async () => {
    const response = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/content-reader/v1/mcp`,
    );

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/content-reader/v1/mcp`);
  });

  it('serves content-governance path-specific OAuth protected resource metadata', async () => {
    const response = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/content-governance/v1/mcp`,
    );

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/content-governance/v1/mcp`);
  });

  it('returns 401 with organization-audit resource_metadata on that persona path', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/organization-audit/v1/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get('www-authenticate');
    expect(wwwAuthenticate).toContain(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/organization-audit/v1/mcp`,
    );
    expect(wwwAuthenticate).not.toContain('semantic-layer/v1/mcp');
  });

  it('returns 401 with content-reader resource_metadata on that persona path', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/content-reader/v1/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get('www-authenticate');
    expect(wwwAuthenticate).toContain(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/content-reader/v1/mcp`,
    );
    expect(wwwAuthenticate).not.toContain('semantic-layer/v1/mcp');
  });

  it('returns 401 with content-governance resource_metadata on that persona path', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/content-governance/v1/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get('www-authenticate');
    expect(wwwAuthenticate).toContain(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/content-governance/v1/mcp`,
    );
    expect(wwwAuthenticate).not.toContain('semantic-layer/v1/mcp');
  });

  it('maps token-a and token-b to distinct authenticated users upstream', async () => {
    const responseA = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    const responseB = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_B });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_B}`);
  });

  it('bridges initialize form-elicitation caps to a later content-governance tools/call', async () => {
    const governancePath = '/content-governance/v1/mcp';
    const init = await postMcp(
      mcpServer.baseUrl,
      {
        ...INITIALIZE_BODY,
        params: {
          ...INITIALIZE_BODY.params,
          capabilities: { elicitation: { form: {} } },
        },
      },
      { token: TOKEN_A, path: governancePath },
    );
    expect(init.status).toBe(200);

    const call = await postMcp(
      mcpServer.baseUrl,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'lightdash_delete_chart',
          arguments: {
            projectUuid: '11111111-1111-4111-8111-111111111111',
            chartUuidOrSlug: '22222222-2222-4222-8222-222222222222',
          },
        },
        id: 2,
      },
      { token: TOKEN_A, path: governancePath },
    );
    expect(call.status).toBe(200);
    const text = parseSseOrJsonToolText(await call.text());
    // Caps bridge worked: past ELICITATION_REQUIRED into chart resolve (mock has no chart).
    expect(text).not.toContain('ELICITATION_REQUIRED');
    expect(text).toContain('CONTENT_NOT_FOUND');
  });

  it('returns 503 when Lightdash user validation is unavailable', async () => {
    const unavailableServer = createServer((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'error',
          error: { statusCode: 503, name: 'ServiceUnavailable', message: 'Down' },
        }),
      );
    });
    await listen(unavailableServer, 0, '127.0.0.1');
    const unavailableAddress = unavailableServer.address() as AddressInfo;
    const unavailableUrl = `http://127.0.0.1:${unavailableAddress.port}`;

    const downServer = await createStreamableHttpServer({
      ...baseOAuthConfig(unavailableUrl),
    });

    try {
      const response = await postMcp(downServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'temporarily_unavailable',
        error_description: 'Lightdash is temporarily unavailable',
      });
    } finally {
      await downServer.close();
      await new Promise<void>((resolve, reject) => {
        unavailableServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });
});

describe('MCP HTTP OAuth integration (continued)', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl),
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    resetClientCapabilitiesCacheForTests();
    vi.restoreAllMocks();
  });

  it('protected-resource metadata authorization_servers points at MCP broker AS metadata', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);
    expect(response.status).toBe(200);

    const metadata = (await response.json()) as {
      authorization_servers: string[];
    };
    expect(metadata.authorization_servers).toEqual([mcpServer.baseUrl]);
    const asMetadataUrl = getAuthorizationServerMetadataUrl(metadata.authorization_servers[0]);
    expect(asMetadataUrl).toBe(`${mcpServer.baseUrl}/.well-known/oauth-authorization-server`);

    const asResponse = await fetch(asMetadataUrl);
    expect(asResponse.status).toBe(200);
    const asMetadata = (await asResponse.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
    };
    expect(asMetadata.authorization_endpoint).toBe(`${mcpServer.baseUrl}/oauth/authorize`);
    expect(asMetadata.token_endpoint).toBe(`${mcpServer.baseUrl}/oauth/token`);
    expect(asMetadata.registration_endpoint).toBe(`${mcpServer.baseUrl}/oauth/register`);
  });

  it('handles initialize with opaque OAuth bearer when endpoint scopes are unset', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: OPAQUE_TOKEN_A });

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeFalsy();
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${OPAQUE_TOKEN_A}`);
  });

  it('accepts TOKEN_READ_ONLY (mcp:read scope) on initialize', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: TOKEN_READ_ONLY,
    });

    expect(response.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_READ_ONLY}`);
  });

  it('accepts TOKEN_A (mcp:read mcp:write scope) on initialize', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: TOKEN_A,
    });

    expect(response.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
  });

  it('forwards bearer token to Lightdash on initialize for opaque credentials', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: OPAQUE_TOKEN_A,
    });

    expect(response.status).toBe(200);
    const userHeaders = mockLightdash.authorizationHeaders.filter(
      (h) => h === `Bearer ${OPAQUE_TOKEN_A}`,
    );
    expect(userHeaders.length).toBeGreaterThan(0);
  });
});

describe('MCP HTTP CORS integration', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl),
      allowedOrigins: ['https://app.example.com'],
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    resetClientCapabilitiesCacheForTests();
    vi.restoreAllMocks();
  });

  it('sets CORS headers for allowed origins on metadata', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`, {
      headers: { Origin: 'https://app.example.com' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('handles CORS preflight OPTIONS requests', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('MCP-Protocol-Version');
  });

  it('returns 403 for disallowed origins', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('origin not allowed');
  });
});

describe('MCP HTTP transport (sessionless)', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl),
      maxBodyBytes: 512,
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    resetClientCapabilitiesCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns 413 for oversized JSON body after OAuth authentication', async () => {
    const hugeBody = JSON.stringify({
      ...INITIALIZE_BODY,
      params: { ...INITIALIZE_BODY.params, padding: 'x'.repeat(1024) },
    });

    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN_A}`,
      },
      body: hugeBody,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload Too Large' });
  });

  it('returns 405 for GET on persona endpoint (sessionless, no persistent streams)', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN_A}`,
      },
    });

    expect(response.status).toBe(405);
  });

  it('returns 405 for DELETE on persona endpoint (sessionless, no sessions to close)', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TOKEN_A}`,
      },
    });

    expect(response.status).toBe(405);
  });
});

describe('MCP HTTP shared-key integration', () => {
  let mcpServer: McpHttpServer;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.LIGHTDASH_URL = 'https://app.lightdash.cloud';
    process.env.LIGHTDASH_API_KEY = 'ldpat_test_key';

    mcpServer = await createStreamableHttpServer({
      lightdashUrl: 'https://app.lightdash.cloud',
      host: '127.0.0.1',
      port: 0,
      mcpPath: '/semantic-layer/v1/mcp',
      authMode: 'shared-key',
      sharedKey: new SecretString('shared-secret'),
      allowedOrigins: [],
      maxBodyBytes: 1024 * 1024,
      requiredScopes: [],
      scopesSupported: ['mcp:read'],
      validateToken: false,
      tokenValidationCacheTtlMs: 30_000,
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    process.env = { ...originalEnv };
    resetClientCapabilitiesCacheForTests();
    vi.restoreAllMocks();
  });

  it('requires shared key on MCP endpoint', async () => {
    const unauthorized = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY);
    expect(unauthorized.status).toBe(401);

    const authorized = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: 'shared-secret',
    });
    expect(authorized.status).toBe(200);
    // Sessionless: no session-id
    expect(authorized.headers.get('mcp-session-id')).toBeFalsy();
  });

  it('returns 401 before reading oversized bodies when shared key is missing', async () => {
    const hugeBody = JSON.stringify({
      ...INITIALIZE_BODY,
      params: { ...INITIALIZE_BODY.params, padding: 'x'.repeat(2048) },
    });

    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: hugeBody,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('accepts shared key via X-API-Key header', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-API-Key': 'shared-secret',
      },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeFalsy();
  });
});
