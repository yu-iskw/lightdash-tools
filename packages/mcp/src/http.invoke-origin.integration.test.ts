import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INITIALIZE_BODY,
  TOKEN_A,
  baseOAuthConfig,
  brokerAccessToken,
  nodeRequest,
  postMcp,
  startMockLightdashServer,
  type McpHttpServer,
  type MockLightdashServer,
} from './http.integration.helpers.js';
import { createStreamableHttpServer } from './transports/streamable-http.js';

describe('MCP HTTP extra invoke-origin OAuth', () => {
  const invokeHost = 'mcp.ilb.internal';
  const invokeOrigin = `http://${invokeHost}`;
  let mockLightdash: MockLightdashServer;
  let mcpServer: McpHttpServer;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockLightdash = await startMockLightdashServer();
    mcpServer = await createStreamableHttpServer({
      ...baseOAuthConfig(mockLightdash.baseUrl, {
        invokeOrigins: [new URL(invokeOrigin)],
      }),
    });
  });

  afterEach(async () => {
    await mcpServer.close();
    await mockLightdash.close();
    vi.restoreAllMocks();
  });

  it('keeps public PRM and AS metadata on the listen Host', async () => {
    const prm = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-protected-resource`);
    expect(prm.status).toBe(200);
    const prmBody = (await prm.json()) as { resource: string; authorization_servers: string[] };
    expect(prmBody.authorization_servers).toEqual([mcpServer.baseUrl]);
    expect(prmBody.resource).toBe(`${mcpServer.baseUrl}/semantic-layer/v1/mcp`);

    const asRes = await fetch(`${mcpServer.baseUrl}/.well-known/oauth-authorization-server`);
    const asBody = (await asRes.json()) as {
      issuer: string;
      token_endpoint: string;
    };
    expect(asBody.issuer).toBe(mcpServer.baseUrl);
    expect(asBody.token_endpoint).toBe(`${mcpServer.baseUrl}/oauth/token`);
  });

  it('advertises invoke-origin PRM and token/DCR when Host matches', async () => {
    const headers = { host: invokeHost, 'x-forwarded-proto': 'http' };
    const prm = await nodeRequest({
      baseUrl: mcpServer.baseUrl,
      path: '/.well-known/oauth-protected-resource',
      headers,
    });
    expect(prm.status).toBe(200);
    expect(prm.json).toEqual({
      resource: `${invokeOrigin}/semantic-layer/v1/mcp`,
      authorization_servers: [invokeOrigin],
      bearer_methods_supported: ['header'],
      scopes_supported: [],
    });

    const asRes = await nodeRequest({
      baseUrl: mcpServer.baseUrl,
      path: '/.well-known/oauth-authorization-server',
      headers,
    });
    expect(asRes.status).toBe(200);
    const asBody = asRes.json as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
    };
    expect(asBody.issuer).toBe(mcpServer.baseUrl);
    expect(asBody.authorization_endpoint).toBe(`${mcpServer.baseUrl}/oauth/authorize`);
    expect(asBody.token_endpoint).toBe(`${invokeOrigin}/oauth/token`);
    expect(asBody.registration_endpoint).toBe(`${invokeOrigin}/oauth/register`);
  });

  it('does not inherit invoke metadata for the same hostname on another port', async () => {
    const prm = await nodeRequest({
      baseUrl: mcpServer.baseUrl,
      path: '/.well-known/oauth-protected-resource',
      headers: { host: `${invokeHost}:9999`, 'x-forwarded-proto': 'http' },
    });
    expect(prm.status).toBe(200);
    const body = prm.json as { authorization_servers: string[] };
    expect(body.authorization_servers).toEqual([mcpServer.baseUrl]);
  });

  it('verifies an invoke-origin token only when Host matches that origin', async () => {
    const invokeToken = brokerAccessToken(invokeOrigin, TOKEN_A);
    const invokeHeaders = {
      host: invokeHost,
      'x-forwarded-proto': 'http',
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${invokeToken}`,
    };

    const ok = await nodeRequest({
      baseUrl: mcpServer.baseUrl,
      path: '/semantic-layer/v1/mcp',
      method: 'POST',
      headers: invokeHeaders,
      body: JSON.stringify(INITIALIZE_BODY),
    });
    expect(ok.status).toBe(200);

    const mismatch = await postMcp(mcpServer.baseUrl, INITIALIZE_BODY, { token: invokeToken });
    expect(mismatch.status).toBe(401);
  });

  it('rejects a public-audience token when Host is the extra invoke origin', async () => {
    const publicToken = brokerAccessToken(mcpServer.baseUrl, TOKEN_A);
    const res = await nodeRequest({
      baseUrl: mcpServer.baseUrl,
      path: '/semantic-layer/v1/mcp',
      method: 'POST',
      headers: {
        host: invokeHost,
        'x-forwarded-proto': 'http',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify(INITIALIZE_BODY),
    });
    expect(res.status).toBe(401);
  });
});
