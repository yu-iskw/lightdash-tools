import { createHash } from 'node:crypto';

import { SecretString } from '@lightdash-tools/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildBrokerAuthorizationServerMetadata } from './as-metadata.js';
import { buildLightdashAuthorizeUrl } from './lightdash-token.js';
import { OAuthBrokerStore } from './pending-store.js';
import { verifyPkce } from './pkce.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';

function baseConfig(overrides: Partial<McpHttpConfig> = {}): McpHttpConfig {
  return {
    lightdashUrl: 'https://app.lightdash.cloud',
    host: '0.0.0.0',
    port: 3100,
    publicUrl: 'https://mcp.example.com',
    mcpPath: '/semantic-layer/v1/mcp',
    authMode: 'lightdash-oauth',
    oauthClientId: 'ld-client',
    oauthClientSecret: new SecretString('ld-secret'),
    allowedOrigins: [],
    maxBodyBytes: 1024 * 1024,
    sessionTtlMs: 60_000,
    maxSessions: 10,
    maxSessionsPerSubject: 2,
    sessionCleanupMs: 1000,
    requiredScopes: [],
    scopesSupported: [],
    validateToken: true,
    tokenValidationCacheTtlMs: 10_000,
    ...overrides,
  };
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

  it('issues and consumes one-time broker codes', () => {
    const store = new OAuthBrokerStore();
    const pending = store.createPending({
      clientId: 'mcp-public-client',
      redirectUri: 'http://127.0.0.1:9999/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
    });
    expect(pending).toBeDefined();
    expect(store.takePending(pending!.brokerState)?.clientId).toBe('mcp-public-client');
    expect(store.takePending(pending!.brokerState)).toBeUndefined();

    const pending2 = store.createPending({
      clientId: 'mcp-public-client',
      redirectUri: 'http://127.0.0.1:9999/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
    });
    expect(pending2).toBeDefined();
    const issued = store.issueCode(pending2!, { accessToken: 'atok' });
    expect(issued).toBeDefined();
    expect(store.getCode(issued!.code)?.accessToken).toBe('atok');
    expect(store.takeCode(issued!.code)?.accessToken).toBe('atok');
    expect(store.takeCode(issued!.code)).toBeUndefined();
  });

  it('keeps issued code after failed PKCE peek so a later redeem can succeed', () => {
    const store = new OAuthBrokerStore();
    const verifier = 'test-verifier-value-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const pending = store.createPending({
      clientId: 'mcp-public-client',
      redirectUri: 'http://localhost:8787/callback',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    expect(pending).toBeDefined();
    const issued = store.issueCode(pending!, { accessToken: 'atok' });
    expect(issued).toBeDefined();

    expect(verifyPkce('wrong-verifier', issued!.codeChallenge, 'S256')).toBe(false);
    expect(store.getCode(issued!.code)?.accessToken).toBe('atok');
    expect(verifyPkce(verifier, issued!.codeChallenge, 'S256')).toBe(true);
    expect(store.takeCode(issued!.code)?.accessToken).toBe('atok');
    expect(store.getCode(issued!.code)).toBeUndefined();
  });
});
