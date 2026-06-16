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

async function parseMcpResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as unknown;
  }

  const dataLines = text.split('\n').filter((line) => line.startsWith('data: '));
  const last = dataLines.length > 0 ? dataLines[dataLines.length - 1] : undefined;
  if (!last) return text;
  return JSON.parse(last.slice('data: '.length)) as unknown;
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
    expect(wwwAuthenticate).toContain(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/mcp`,
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
    expect(await resumeResponse.json()).toEqual({
      error: 'invalid_token',
      error_description: 'Session token mismatch',
    });
    expect(resumeResponse.headers.get('www-authenticate')).toContain('invalid_token');
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

  it('serves path-specific OAuth protected resource metadata', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/mcp`);
  });

  it('returns 400 for malformed JSON POST bodies', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/mcp`, {
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

  it('maps token-a and token-b to distinct authenticated users upstream', async () => {
    const responseA = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    const responseB = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_B });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_B}`);
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
    const response = await fetch(`${mcpServer.baseUrl}/mcp`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('MCP-Protocol-Version');
  });
});

describe('MCP HTTP unrestricted CORS integration', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl),
      allowedOrigins: [],
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    vi.restoreAllMocks();
  });

  it('echoes CORS headers when allowedOrigins is empty', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`, {
      headers: { Origin: 'https://browser.example.com' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://browser.example.com');
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
    vi.restoreAllMocks();
  });

  it('calls ldt__get_authenticated_user over an OAuth HTTP session', async () => {
    const initResponse = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const userCallsBefore = mockLightdash.authorizationHeaders.length;

    await postMcp(
      mcpServer.baseUrl,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { token: TOKEN_A, sessionId: sessionId ?? undefined },
    );

    const callResponse = await postMcp(
      mcpServer.baseUrl,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'ldt__get_authenticated_user', arguments: {} },
        id: 2,
      },
      { token: TOKEN_A, sessionId: sessionId ?? undefined },
    );

    expect(callResponse.status).toBe(200);
    const payload = (await parseMcpResponse(callResponse)) as {
      result?: { content?: Array<{ text?: string }> };
    };
    const text = payload.result?.content?.[0]?.text ?? '';
    expect(text).toContain(USER_A.userUuid);
    expect(text).not.toContain(TOKEN_A);
    expect(mockLightdash.authorizationHeaders.length).toBeGreaterThan(userCallsBefore);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
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

  it('accepts shared key via X-API-Key header', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-API-Key': 'shared-secret',
      },
      body: JSON.stringify(INITIALIZE_BODY),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
  });
});
