import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { SecretString } from '@lightdash-tools/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeTestMcpHttpConfig } from '../../config/test-mcp-http-config.js';

import { buildBrokerAuthorizationServerMetadata } from './as-metadata.js';
import {
  buildLightdashAuthorizeUrl,
  exchangeLightdashAuthorizationCode,
} from './lightdash-token.js';
import { verifyMcpAccessToken } from './mcp-access-token.js';
import { InMemoryOAuthBrokerStore } from './pending-store.js';
import { verifyPkce } from './pkce.js';
import { createOAuthBroker } from './routes.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const RESOURCE = 'https://mcp.example.com/semantic-layer/v1/mcp';

function baseConfig(overrides: Partial<McpHttpConfig> = {}): McpHttpConfig {
  return makeTestMcpHttpConfig({
    host: '0.0.0.0',
    oauthClientId: 'ld-client',
    oauthClientSecret: new SecretString('ld-secret'),
    maxBodyBytes: 1024 * 1024,
    requiredScopes: [],
    scopesSupported: [],
    tokenValidationCacheTtlMs: 10_000,
    ...overrides,
  });
}

function mockRes(): ServerResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string[] | number | string | undefined>;
} {
  const state = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string[] | number | string | undefined>,
  };
  const res = {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    get headers() {
      return state.headers;
    },
    writeHead(code: number, headers?: Record<string, string[] | number | string | undefined>) {
      state.statusCode = code;
      state.headers = { ...state.headers, ...headers };
      return res;
    },
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        try {
          state.body = JSON.parse(text) as unknown;
        } catch {
          state.body = text;
        }
      }
      return res;
    },
  };
  return res as unknown as ServerResponse & typeof state;
}

function mockReq(
  method: string,
  url: string,
  body?: string,
  contentType = 'application/x-www-form-urlencoded',
  extraHeaders?: Record<string, string>,
): IncomingMessage {
  const req = new EventEmitter() as EventEmitter & IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'mcp.example.com',
    ...(body !== undefined ? { 'content-type': contentType } : {}),
    ...extraHeaders,
  };
  queueMicrotask(() => {
    if (body !== undefined) {
      req.emit('data', Buffer.from(body, 'utf8'));
    }
    req.emit('end');
  });
  return req;
}

function authorizeUrl(clientId: string, redirectUri: string, challenge: string): string {
  return (
    `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256` +
    `&resource=${encodeURIComponent(RESOURCE)}`
  );
}

describe('oauth broker helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds downstream Lightdash authorize URL without MCP resource/scope passthrough', () => {
    const url = buildLightdashAuthorizeUrl(baseConfig(), { state: 'broker-state' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://app.lightdash.cloud/api/v1/oauth/authorize',
    );
    expect(parsed.searchParams.get('client_id')).toBe('ld-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://mcp.example.com/oauth/callback');
    expect(parsed.searchParams.get('state')).toBe('broker-state');
    expect(parsed.searchParams.get('code_challenge')).toBeNull();
    expect(parsed.searchParams.get('resource')).toBeNull();
    expect(parsed.searchParams.get('scope')).toBeNull();
  });

  it('publishes AS metadata pointing at broker endpoints', () => {
    const metadata = buildBrokerAuthorizationServerMetadata(
      baseConfig(),
      'https://mcp.example.com',
    );
    expect(metadata.issuer).toBe('https://mcp.example.com');
    expect(metadata.authorization_endpoint).toBe('https://mcp.example.com/oauth/authorize');
    expect(metadata.token_endpoint).toBe('https://mcp.example.com/oauth/token');
    expect(metadata.registration_endpoint).toBe('https://mcp.example.com/oauth/register');
  });

  it('moves token and DCR onto an extra invoke origin while issuer stays public', () => {
    const metadata = buildBrokerAuthorizationServerMetadata(
      baseConfig(),
      'http://mcp.ilb.internal',
    );
    expect(metadata.issuer).toBe('https://mcp.example.com');
    expect(metadata.authorization_endpoint).toBe('https://mcp.example.com/oauth/authorize');
    expect(metadata.token_endpoint).toBe('http://mcp.ilb.internal/oauth/token');
    expect(metadata.registration_endpoint).toBe('http://mcp.ilb.internal/oauth/register');
  });

  it('serves host-aware AS metadata when Host matches an extra invoke origin', async () => {
    const broker = createOAuthBroker(
      baseConfig({ invokeOrigins: [new URL('http://mcp.ilb.internal')] }),
    );
    const res = mockRes();
    await broker.handle(
      mockReq('GET', '/.well-known/oauth-authorization-server', undefined, undefined, {
        host: 'mcp.ilb.internal',
        'x-forwarded-proto': 'http',
      }),
      res,
      '/.well-known/oauth-authorization-server',
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
    };
    expect(body.issuer).toBe('https://mcp.example.com');
    expect(body.authorization_endpoint).toBe('https://mcp.example.com/oauth/authorize');
    expect(body.token_endpoint).toBe('http://mcp.ilb.internal/oauth/token');
    expect(body.registration_endpoint).toBe('http://mcp.ilb.internal/oauth/register');
  });

  it('verifies S256 PKCE and rejects PLAIN', () => {
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(verifier, challenge, 'S256')).toBe(true);
    expect(verifyPkce('wrong', challenge, 'S256')).toBe(false);
    expect(verifyPkce(verifier, verifier, 'PLAIN')).toBe(false);
    expect(verifyPkce(undefined, challenge, 'S256')).toBe(false);
  });

  it('issues and consumes one-time broker codes without refresh tokens', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const pending = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://127.0.0.1:9999/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      resource: RESOURCE,
    });
    expect(pending).toBeDefined();
    expect((await store.takePending(pending!.brokerState))?.clientId).toBe('client-a');
    expect(await store.takePending(pending!.brokerState)).toBeUndefined();

    const pending2 = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://127.0.0.1:9999/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      resource: RESOURCE,
    });
    expect(pending2).toBeDefined();
    const issued = await store.issueCode(pending2!, { accessToken: 'atok' });
    expect(issued).toBeDefined();
    expect(issued).not.toHaveProperty('refreshToken');
    const taken = await store.takeCode(issued!.code);
    expect(taken?.accessToken).toBe('atok');
    expect(taken?.resource).toBe(RESOURCE);
    expect(await store.takeCode(issued!.code)).toBeUndefined();
  });

  it('registers clients and binds exact redirect URIs', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const registered = await store.registerClient(['http://127.0.0.1:8787/callback']);
    expect(registered).toBeDefined();
    expect(
      await store.isRedirectAllowedForClient(
        registered!.clientId,
        'http://127.0.0.1:8787/callback',
      ),
    ).toBe(true);
    expect(
      await store.isRedirectAllowedForClient(
        registered!.clientId,
        'https://attacker.example/callback',
      ),
    ).toBe(false);
    expect(
      await store.isRedirectAllowedForClient('unknown', 'http://127.0.0.1:8787/callback'),
    ).toBe(false);
  });

  it('restores issued code after failed PKCE so a later redeem can succeed', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const pending = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://localhost:8787/callback',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      resource: RESOURCE,
    });
    expect(pending).toBeDefined();
    const issued = await store.issueCode(pending!, { accessToken: 'atok' });
    expect(issued).toBeDefined();

    // Simulate validateTokenGrant: take → failed PKCE → restore.
    const taken = await store.takeCode(issued!.code);
    expect(taken).toBeDefined();
    expect(verifyPkce('wrong-verifier', taken!.codeChallenge, 'S256')).toBe(false);
    await store.restoreCode(taken!);
    expect((await store.getCode(issued!.code))?.accessToken).toBe('atok');

    const redeemed = await store.takeCode(issued!.code);
    expect(redeemed?.accessToken).toBe('atok');
    expect(verifyPkce(verifier, redeemed!.codeChallenge, 'S256')).toBe(true);
    expect(await store.takeCode(issued!.code)).toBeUndefined();
  });

  it('forwards Proxy-Authorization on Lightdash token exchange when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ld-access', expires_in: 3600 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await exchangeLightdashAuthorizationCode(
      baseConfig({ proxyAuthorization: new SecretString('Bearer proxy-token') }),
      'upstream-code',
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Proxy-Authorization']).toBe('Bearer proxy-token');
  });
});

describe('oauth broker DCR + authorize binding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a unique client_id and allows authorize only for that redirect_uri', async () => {
    const broker = createOAuthBroker(baseConfig());
    const redirectUri = 'http://127.0.0.1:8787/callback';

    const registerRes = mockRes();
    await broker.handle(
      mockReq('POST', '/oauth/register', `redirect_uris=${encodeURIComponent(redirectUri)}`),
      registerRes,
      '/oauth/register',
    );
    expect(registerRes.statusCode).toBe(201);
    const registered = registerRes.body as { client_id: string; redirect_uris: string[] };
    expect(registered.client_id).toBeTruthy();
    expect(registered.client_id).not.toBe('mcp-public-client');
    expect(registered.redirect_uris).toEqual([redirectUri]);

    const challenge = createHash('sha256').update('verifier').digest('base64url');
    const okRes = mockRes();
    await broker.handle(
      mockReq('GET', authorizeUrl(registered.client_id, redirectUri, challenge)),
      okRes,
      '/oauth/authorize',
    );
    expect(okRes.statusCode).toBe(302);
    const upstream = new URL(String(okRes.headers.Location));
    expect(upstream.pathname).toContain('/api/v1/oauth/authorize');
    expect(upstream.searchParams.get('resource')).toBeNull();

    const badRes = mockRes();
    await broker.handle(
      mockReq('GET', authorizeUrl(registered.client_id, 'https://attacker.example/cb', challenge)),
      badRes,
      '/oauth/authorize',
    );
    expect(badRes.statusCode).toBe(400);
    expect((badRes.body as { error: string }).error).toBe('invalid_request');
  });

  it('rejects authorize without prior DCR', async () => {
    const broker = createOAuthBroker(baseConfig());
    const challenge = createHash('sha256').update('verifier').digest('base64url');
    const res = mockRes();
    await broker.handle(
      mockReq('GET', authorizeUrl('unknown', 'https://app.example/cb', challenge)),
      res,
      '/oauth/authorize',
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_client');
  });

  it('requires a valid enabled MCP resource at authorize', async () => {
    const broker = createOAuthBroker(baseConfig());
    const redirectUri = 'http://127.0.0.1:8787/callback';
    const registerRes = mockRes();
    await broker.handle(
      mockReq('POST', '/oauth/register', `redirect_uris=${encodeURIComponent(redirectUri)}`),
      registerRes,
      '/oauth/register',
    );
    const { client_id: clientId } = registerRes.body as { client_id: string };
    const challenge = createHash('sha256').update('verifier').digest('base64url');

    const missingRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
      missingRes,
      '/oauth/authorize',
    );
    expect(missingRes.statusCode).toBe(400);
    expect((missingRes.body as { error: string }).error).toBe('invalid_request');

    const wrongRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        authorizeUrl(clientId, redirectUri, challenge).replace(
          encodeURIComponent(RESOURCE),
          encodeURIComponent('https://attacker.example/mcp'),
        ),
      ),
      wrongRes,
      '/oauth/authorize',
    );
    expect(wrongRes.statusCode).toBe(400);
    expect((wrongRes.body as { error: string }).error).toBe('invalid_target');
  });

  it('accepts an extra invoke-origin profile resource at authorize', async () => {
    const invokeResource = 'http://mcp.ilb.internal/semantic-layer/v1/mcp';
    const broker = createOAuthBroker(
      baseConfig({ invokeOrigins: [new URL('http://mcp.ilb.internal')] }),
    );
    const redirectUri = 'http://127.0.0.1:8787/callback';
    const registerRes = mockRes();
    await broker.handle(
      mockReq('POST', '/oauth/register', `redirect_uris=${encodeURIComponent(redirectUri)}`),
      registerRes,
      '/oauth/register',
    );
    const { client_id: clientId } = registerRes.body as { client_id: string };
    const challenge = createHash('sha256').update('verifier').digest('base64url');

    const authorizeRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        authorizeUrl(clientId, redirectUri, challenge).replace(
          encodeURIComponent(RESOURCE),
          encodeURIComponent(invokeResource),
        ),
      ),
      authorizeRes,
      '/oauth/authorize',
    );
    expect(authorizeRes.statusCode).toBe(302);
    expect(String(authorizeRes.headers.Location)).toContain('/api/v1/oauth/authorize');
  });

  it('accepts an extra invoke-origin resource that includes a default port', async () => {
    const invokeResource = 'http://mcp.ilb.internal:80/semantic-layer/v1/mcp';
    const broker = createOAuthBroker(
      baseConfig({ invokeOrigins: [new URL('http://mcp.ilb.internal')] }),
    );
    const redirectUri = 'http://127.0.0.1:8787/callback';
    const registerRes = mockRes();
    await broker.handle(
      mockReq('POST', '/oauth/register', `redirect_uris=${encodeURIComponent(redirectUri)}`),
      registerRes,
      '/oauth/register',
    );
    const { client_id: clientId } = registerRes.body as { client_id: string };
    const challenge = createHash('sha256').update('verifier').digest('base64url');

    const authorizeRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        authorizeUrl(clientId, redirectUri, challenge).replace(
          encodeURIComponent(RESOURCE),
          encodeURIComponent(invokeResource),
        ),
      ),
      authorizeRes,
      '/oauth/authorize',
    );
    expect(authorizeRes.statusCode).toBe(302);
  });

  it('returns an MCP-issued resource-bound token and never exposes Lightdash tokens', async () => {
    const config = baseConfig();
    const broker = createOAuthBroker(config);
    const redirectUri = 'http://127.0.0.1:8787/callback';
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const registerRes = mockRes();
    await broker.handle(
      mockReq('POST', '/oauth/register', `redirect_uris=${encodeURIComponent(redirectUri)}`),
      registerRes,
      '/oauth/register',
    );
    const { client_id: clientId } = registerRes.body as { client_id: string };

    const authorizeRes = mockRes();
    await broker.handle(
      mockReq('GET', authorizeUrl(clientId, redirectUri, challenge)),
      authorizeRes,
      '/oauth/authorize',
    );
    const ldAuthorize = new URL(String(authorizeRes.headers.Location));
    const brokerState = ldAuthorize.searchParams.get('state');
    expect(brokerState).toBeTruthy();
    expect(ldAuthorize.searchParams.get('resource')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'ld-access',
          refresh_token: 'ld-refresh-should-not-leak',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'lightdash-upstream-scope-must-not-become-mcp-scope',
        }),
      }),
    );

    const callbackRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        `/oauth/callback?code=upstream-code&state=${encodeURIComponent(brokerState!)}`,
      ),
      callbackRes,
      '/oauth/callback',
    );
    expect(callbackRes.statusCode).toBe(302);
    const clientRedirect = new URL(String(callbackRes.headers.Location));
    const brokerCode = clientRedirect.searchParams.get('code');
    expect(brokerCode).toBeTruthy();

    const tokenRes = mockRes();
    await broker.handle(
      mockReq(
        'POST',
        '/oauth/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: brokerCode!,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: verifier,
          resource: RESOURCE,
        }).toString(),
      ),
      tokenRes,
      '/oauth/token',
    );
    expect(tokenRes.statusCode).toBe(200);
    const tokenBody = tokenRes.body as Record<string, unknown>;
    expect(tokenBody.access_token).not.toBe('ld-access');
    expect(String(tokenBody.access_token)).toMatch(/^ldmcp1\./);
    expect(String(tokenBody.access_token)).not.toContain('ld-access');
    expect(tokenBody).not.toHaveProperty('refresh_token');
    expect(tokenBody.scope).toBeUndefined();

    const decrypted = verifyMcpAccessToken(config, String(tokenBody.access_token), RESOURCE);
    expect(decrypted).toMatchObject({
      lightdashAccessToken: 'ld-access',
      clientId,
      resource: RESOURCE,
    });
  });

  it('binds the token request to the same resource as the authorization request', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const pending = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://127.0.0.1:8787/callback',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      resource: RESOURCE,
    });
    const issued = await store.issueCode(pending!, { accessToken: 'ld-access', expiresIn: 3600 });
    const broker = createOAuthBroker(baseConfig(), store);

    const res = mockRes();
    await broker.handle(
      mockReq(
        'POST',
        '/oauth/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: issued!.code,
          redirect_uri: pending!.redirectUri,
          client_id: pending!.clientId,
          code_verifier: verifier,
          resource: 'https://mcp.example.com/content-governance/v1/mcp',
        }).toString(),
      ),
      res,
      '/oauth/token',
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string; error_description: string }).error).toBe('invalid_grant');
    expect((res.body as { error_description: string }).error_description).toBe('resource mismatch');
    expect(await store.getCode(issued!.code)).toBeDefined();
  });
});
