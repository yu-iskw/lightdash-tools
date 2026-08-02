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
import { InMemoryOAuthBrokerStore } from './pending-store.js';
import { verifyPkce } from './pkce.js';
import { createOAuthBroker } from './routes.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

function baseConfig(overrides: Partial<McpHttpConfig> = {}): McpHttpConfig {
  return makeTestMcpHttpConfig({
    host: '0.0.0.0',
    oauthClientId: 'ld-client',
    oauthClientSecret: new SecretString('ld-secret'),
    maxBodyBytes: 1024 * 1024,
    maxSessionsPerSubject: 2,
    sessionCleanupMs: 1000,
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
): IncomingMessage {
  const req = new EventEmitter() as EventEmitter & IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'mcp.example.com',
    ...(body !== undefined ? { 'content-type': contentType } : {}),
  };
  queueMicrotask(() => {
    if (body !== undefined) {
      req.emit('data', Buffer.from(body, 'utf8'));
    }
    req.emit('end');
  });
  return req;
}

describe('oauth broker helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds Lightdash authorize URL with fixed server callback', () => {
    const url = buildLightdashAuthorizeUrl(baseConfig(), {
      state: 'broker-state',
      resource: 'https://mcp.example.com/semantic-layer/v1/mcp',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://app.lightdash.cloud/api/v1/oauth/authorize',
    );
    expect(parsed.searchParams.get('client_id')).toBe('ld-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://mcp.example.com/oauth/callback');
    expect(parsed.searchParams.get('state')).toBe('broker-state');
    expect(parsed.searchParams.get('code_challenge')).toBeNull();
  });

  it('publishes AS metadata pointing at broker endpoints', () => {
    const metadata = buildBrokerAuthorizationServerMetadata(baseConfig());
    expect(metadata.issuer).toBe('https://mcp.example.com');
    expect(metadata.authorization_endpoint).toBe('https://mcp.example.com/oauth/authorize');
    expect(metadata.token_endpoint).toBe('https://mcp.example.com/oauth/token');
    expect(metadata.registration_endpoint).toBe('https://mcp.example.com/oauth/register');
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
    });
    expect(pending).toBeDefined();
    expect((await store.takePending(pending!.brokerState))?.clientId).toBe('client-a');
    expect(await store.takePending(pending!.brokerState)).toBeUndefined();

    const pending2 = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://127.0.0.1:9999/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
    });
    expect(pending2).toBeDefined();
    const issued = await store.issueCode(pending2!, { accessToken: 'atok' });
    expect(issued).toBeDefined();
    expect((await store.getCode(issued!.code))?.accessToken).toBe('atok');
    expect(await store.getCode(issued!.code)).not.toHaveProperty('refreshToken');
    await store.deleteCode(issued!.code);
    expect(await store.getCode(issued!.code)).toBeUndefined();
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

  it('keeps issued code after failed PKCE peek so a later redeem can succeed', async () => {
    const store = new InMemoryOAuthBrokerStore();
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const pending = await store.createPending({
      clientId: 'client-a',
      redirectUri: 'http://localhost:8787/callback',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    expect(pending).toBeDefined();
    const issued = await store.issueCode(pending!, { accessToken: 'atok' });
    expect(issued).toBeDefined();

    expect(verifyPkce('wrong-verifier', issued!.codeChallenge, 'S256')).toBe(false);
    expect((await store.getCode(issued!.code))?.accessToken).toBe('atok');
    expect(verifyPkce(verifier, issued!.codeChallenge, 'S256')).toBe(true);
    await store.deleteCode(issued!.code);
    expect(await store.getCode(issued!.code)).toBeUndefined();
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
      mockReq(
        'GET',
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(registered.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
      okRes,
      '/oauth/authorize',
    );
    expect(okRes.statusCode).toBe(302);
    expect(String(okRes.headers.Location)).toContain('/api/v1/oauth/authorize');

    const badRes = mockRes();
    await broker.handle(
      mockReq(
        'GET',
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(registered.client_id)}&redirect_uri=${encodeURIComponent('https://attacker.example/cb')}&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
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
      mockReq(
        'GET',
        `/oauth/authorize?response_type=code&client_id=unknown&redirect_uri=${encodeURIComponent('https://app.example/cb')}&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
      res,
      '/oauth/authorize',
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_client');
  });

  it('token response omits refresh_token even when upstream issued one', async () => {
    const broker = createOAuthBroker(baseConfig());
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
      mockReq(
        'GET',
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
      authorizeRes,
      '/oauth/authorize',
    );
    const ldAuthorize = new URL(String(authorizeRes.headers.Location));
    const brokerState = ldAuthorize.searchParams.get('state');
    expect(brokerState).toBeTruthy();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'ld-access',
          refresh_token: 'ld-refresh-should-not-leak',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid',
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
        }).toString(),
      ),
      tokenRes,
      '/oauth/token',
    );
    expect(tokenRes.statusCode).toBe(200);
    const tokenBody = tokenRes.body as Record<string, unknown>;
    expect(tokenBody.access_token).toBe('ld-access');
    expect(tokenBody).not.toHaveProperty('refresh_token');
  });
});
