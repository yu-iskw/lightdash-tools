import { createServer, type Server } from 'node:http';

import { SecretString } from '@lightdash-tools/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStreamableHttpServer } from './transports/streamable-http.js';

import type { McpHttpConfig } from './config/load-mcp-config.js';
import type { AddressInfo } from 'node:net';

const TOKEN_A = 'token-a';
const TOKEN_B = 'token-b';

const USER_A = { userUuid: 'user-a-uuid', email: 'a@example.com' };
const USER_B = { userUuid: 'user-b-uuid', email: 'b@example.com' };

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
  const users: Record<string, { userUuid: string; email: string }> = {
    [TOKEN_A]: USER_A,
    [TOKEN_B]: USER_B,
  };

  const server = createServer((req, res) => {
    const authHeader = req.headers.authorization;
    const auth = typeof authHeader === 'string' ? authHeader : (authHeader?.[0] ?? '');
    authorizationHeaders.push(auth);

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

    res.writeHead(404).end();
  });

  await listen(server, 0, '127.0.0.1');
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
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
    mcpPath: '/mcp',
    authMode: 'lightdash-oauth',
    allowedOrigins: [],
    maxBodyBytes: 1024 * 1024,
    sessionTtlMs: 60_000,
    maxSessions: 10,
    sessionCleanupMs: 60_000,
    requiredScopes: ['mcp:read'],
    scopesSupported: ['mcp:read', 'mcp:write'],
    validateToken: true,
    tokenValidationCacheTtlMs: 30_000,
  };
}

async function postMcp(
  baseUrl: string,
  body: unknown,
  options?: { token?: string; sessionId?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options?.sessionId) {
    headers['Mcp-Session-Id'] = options.sessionId;
  }

  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
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
    vi.restoreAllMocks();
  });

  it('returns 401 with WWW-Authenticate resource_metadata when OAuth token is missing', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY);

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get('www-authenticate');
    expect(wwwAuthenticate).toContain('resource_metadata=');
    expect(wwwAuthenticate).toContain(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);
  });

  it('returns 401 without echoing invalid bearer token in response body', async () => {
    const invalidToken = 'not-a-valid-token';
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: invalidToken });

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(invalidToken);
    expect(response.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('initializes MCP session with valid OAuth bearer and validates upstream Authorization', async () => {
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
  });

  it('returns 401 Session token mismatch when resuming with a different bearer', async () => {
    const initResponse = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const resumeResponse = await postMcp(
      mcpServer.baseUrl,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { token: TOKEN_B, sessionId: sessionId ?? undefined },
    );

    expect(resumeResponse.status).toBe(401);
    expect(await resumeResponse.json()).toEqual({ error: 'Session token mismatch' });
  });

  it('serves OAuth protected resource metadata at /.well-known/oauth-protected-resource', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata).toEqual({
      resource: `${mcpServer.baseUrl}/mcp`,
      authorization_servers: [mockLightdash.baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp:read', 'mcp:write'],
    });
  });

  it('maps token-a and token-b to distinct authenticated users upstream', async () => {
    const responseA = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    const responseB = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_B });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_B}`);
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
      mcpPath: '/mcp',
      authMode: 'shared-key',
      sharedKey: new SecretString('shared-secret'),
      allowedOrigins: [],
      maxBodyBytes: 1024 * 1024,
      sessionTtlMs: 60_000,
      maxSessions: 10,
      sessionCleanupMs: 60_000,
      requiredScopes: ['mcp:read'],
      scopesSupported: ['mcp:read'],
      validateToken: false,
      tokenValidationCacheTtlMs: 30_000,
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('requires shared key on MCP endpoint', async () => {
    const unauthorized = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY);
    expect(unauthorized.status).toBe(401);

    const authorized = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: 'shared-secret',
    });
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get('mcp-session-id')).toBeTruthy();
  });
});
