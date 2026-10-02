import { createServer } from 'node:http';

import { SecretString } from '@lightdash-tools/client';
import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthorizationServerMetadataUrl } from './auth/resource-server/oauth-protected-resource.js';
import { parseEnabledProfiles } from './config/enabled-profiles.js';
import { makeTestMcpHttpConfig } from './config/test-mcp-http-config.js';
import {
  INITIALIZE_BODY,
  OPAQUE_TOKEN_A,
  TOKEN_A,
  TOKEN_B,
  TOKEN_READ_ONLY,
  baseOAuthConfig,
  brokerAccessToken,
  listen,
  postMcp,
  startMockLightdashServer,
} from './http.integration.helpers.js';
import { createStreamableHttpServer } from './transports/streamable-http.js';

import type { McpHttpServer, MockLightdashServer } from './http.integration.helpers.js';
import type { AddressInfo } from 'node:net';

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

  it('handles initialize with an MCP bearer and validates the downstream Lightdash bearer', async () => {
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A);
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: mcpToken });

    expect(response.status).toBe(200);
    // Sessionless: no session-id header is set.
    expect(response.headers.get('mcp-session-id')).toBeFalsy();
    expect(mcpToken).not.toBe(TOKEN_A);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).not.toContain(`Bearer ${mcpToken}`);
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
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A);
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${mcpToken}`,
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

  it('returns 401 with organization-audit resource_metadata on that profile path', async () => {
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

  it('returns 401 with content-reader resource_metadata on that profile path', async () => {
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

  it('returns 401 with content-governance resource_metadata on that profile path', async () => {
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

  it('maps two MCP tokens to distinct authenticated users upstream', async () => {
    const mcpTokenA = brokerAccessToken(mcpServer.baseUrl, TOKEN_A);
    const mcpTokenB = brokerAccessToken(mcpServer.baseUrl, TOKEN_B);
    const responseA = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: mcpTokenA });
    const responseB = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: mcpTokenB });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_B}`);
    expect(mockLightdash.authorizationHeaders).not.toContain(`Bearer ${mcpTokenA}`);
    expect(mockLightdash.authorizationHeaders).not.toContain(`Bearer ${mcpTokenB}`);
  });

  it('accepts form-elicitation caps from per-request _meta on content-governance tools/call', async () => {
    const governancePath = '/content-governance/v1/mcp';
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A, { path: governancePath });
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
          _meta: {
            [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } },
          },
        },
        id: 2,
      },
      { token: mcpToken, path: governancePath },
    );
    expect(call.status).toBe(200);
    const text = parseSseOrJsonToolText(await call.text());
    // Per-request envelope caps: past ELICITATION_REQUIRED into chart resolve (mock has no chart).
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
      const mcpToken = brokerAccessToken(downServer.baseUrl, TOKEN_A);
      const response = await postMcp(downServer.baseUrl, INITIALIZE_BODY, { token: mcpToken });
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

  it('handles initialize when the downstream Lightdash credential is opaque', async () => {
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, OPAQUE_TOKEN_A);
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: mcpToken });

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeFalsy();
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${OPAQUE_TOKEN_A}`);
    expect(mockLightdash.authorizationHeaders).not.toContain(`Bearer ${mcpToken}`);
  });

  it('accepts an MCP token carrying mcp:read scope on initialize', async () => {
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_READ_ONLY, { scope: 'mcp:read' });
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: mcpToken,
    });

    expect(response.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_READ_ONLY}`);
  });

  it('accepts an MCP token carrying mcp:read mcp:write scope on initialize', async () => {
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A, {
      scope: 'mcp:read mcp:write',
    });
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: mcpToken,
    });

    expect(response.status).toBe(200);
    expect(mockLightdash.authorizationHeaders).toContain(`Bearer ${TOKEN_A}`);
  });

  it('forwards only the decrypted downstream bearer to Lightdash', async () => {
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, OPAQUE_TOKEN_A);
    const response = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: mcpToken,
    });

    expect(response.status).toBe(200);
    const downstreamHeaders = mockLightdash.authorizationHeaders.filter(
      (header) => header === `Bearer ${OPAQUE_TOKEN_A}`,
    );
    expect(downstreamHeaders.length).toBeGreaterThan(0);
    expect(mockLightdash.authorizationHeaders).not.toContain(`Bearer ${mcpToken}`);
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
    vi.restoreAllMocks();
  });

  it('returns 413 for oversized JSON body after OAuth authentication', async () => {
    const hugeBody = JSON.stringify({
      ...INITIALIZE_BODY,
      params: { ...INITIALIZE_BODY.params, padding: 'x'.repeat(1024) },
    });
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A);

    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${mcpToken}`,
      },
      body: hugeBody,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload Too Large' });
  });

  it('returns 405 for GET on profile endpoint (sessionless, no persistent streams)', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN_A}`,
      },
    });

    expect(response.status).toBe(405);
  });

  it('returns 405 for DELETE on profile endpoint (sessionless, no sessions to close)', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${TOKEN_A}`,
      },
    });

    expect(response.status).toBe(405);
  });
});

describe('MCP HTTP profile mount allowlist', () => {
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer(
      baseOAuthConfig(mockLightdash.baseUrl, {
        enabledProfiles: parseEnabledProfiles('content-reader'),
      }),
    );
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    vi.restoreAllMocks();
  });

  it('404s disabled profile MCP paths and their path-specific PRM', async () => {
    const mcpResponse = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: TOKEN_A });
    expect(mcpResponse.status).toBe(404);

    const prmResponse = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/semantic-layer/v1/mcp`,
    );
    expect(prmResponse.status).toBe(404);
  });

  it('keeps enabled profile MCP and PRM reachable', async () => {
    const contentReaderPath = '/content-reader/v1/mcp';
    const mcpToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A, { path: contentReaderPath });
    const mcpResponse = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, {
      token: mcpToken,
      path: contentReaderPath,
    });
    expect(mcpResponse.status).toBe(200);

    const prmResponse = await fetch(
      `${mcpServer.baseUrl}/.well-known/oauth-protected-resource/content-reader/v1/mcp`,
    );
    expect(prmResponse.status).toBe(200);
    const metadata = (await prmResponse.json()) as { resource: string };
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/content-reader/v1/mcp`);
  });

  it('serves root PRM for the first enabled profile path', async () => {
    const response = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);
    expect(response.status).toBe(200);
    const metadata = (await response.json()) as { resource: string };
    expect(metadata.resource).toBe(`${mcpServer.baseUrl}/content-reader/v1/mcp`);
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

    mcpServer = await createStreamableHttpServer(
      makeTestMcpHttpConfig({
        port: 0,
        publicUrl: undefined,
        authMode: 'shared-key',
        sharedKey: new SecretString('shared-secret'),
        maxBodyBytes: 1024 * 1024,
        requiredScopes: [],
        scopesSupported: ['mcp:read'],
        validateToken: false,
      }),
    );
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
