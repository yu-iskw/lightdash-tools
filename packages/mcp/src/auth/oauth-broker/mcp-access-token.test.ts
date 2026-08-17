import { SecretString } from '@lightdash-tools/client';
import { describe, expect, it } from 'vitest';

import { makeTestMcpHttpConfig } from '../../config/test-mcp-http-config.js';

import { mintMcpAccessToken, verifyMcpAccessToken } from './mcp-access-token.js';

const config = makeTestMcpHttpConfig({
  oauthClientId: 'ld-client',
  oauthClientSecret: new SecretString('test-lightdash-confidential-client-secret'),
});

const RESOURCE = 'https://mcp.example.com/semantic-layer/v1/mcp';
const OTHER_RESOURCE = 'https://mcp.example.com/content-governance/v1/mcp';
const NOW = 1_800_000_000_000;

describe('MCP broker access token', () => {
  it('round-trips a downstream credential without exposing it as the bearer token', () => {
    const minted = mintMcpAccessToken(
      config,
      {
        lightdashAccessToken: 'ld-upstream-secret',
        clientId: 'mcp-client-1',
        resource: RESOURCE,
        scope: 'mcp:read',
        expiresAtMs: NOW + 60_000,
      },
      NOW,
    );

    expect(minted.accessToken).toMatch(/^ldmcp1\./);
    expect(minted.accessToken).not.toContain('ld-upstream-secret');
    expect(minted.expiresIn).toBe(60);
    expect(verifyMcpAccessToken(config, minted.accessToken, RESOURCE, NOW)).toMatchObject({
      lightdashAccessToken: 'ld-upstream-secret',
      clientId: 'mcp-client-1',
      resource: RESOURCE,
      scope: 'mcp:read',
    });
  });

  it('rejects a token at a different MCP protected resource', () => {
    const { accessToken } = mintMcpAccessToken(
      config,
      {
        lightdashAccessToken: 'ld-upstream-secret',
        clientId: 'mcp-client-1',
        resource: RESOURCE,
        expiresAtMs: NOW + 60_000,
      },
      NOW,
    );

    expect(verifyMcpAccessToken(config, accessToken, OTHER_RESOURCE, NOW)).toBeUndefined();
  });

  it('rejects tampered and expired tokens', () => {
    const { accessToken } = mintMcpAccessToken(
      config,
      {
        lightdashAccessToken: 'ld-upstream-secret',
        clientId: 'mcp-client-1',
        resource: RESOURCE,
        expiresAtMs: NOW + 1_000,
      },
      NOW,
    );

    const tampered = `${accessToken.slice(0, -1)}${accessToken.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyMcpAccessToken(config, tampered, RESOURCE, NOW)).toBeUndefined();
    expect(verifyMcpAccessToken(config, accessToken, RESOURCE, NOW + 2_000)).toBeUndefined();
  });

  it('rejects raw downstream Lightdash access tokens', () => {
    expect(verifyMcpAccessToken(config, 'ld-upstream-secret', RESOURCE, NOW)).toBeUndefined();
  });
});
