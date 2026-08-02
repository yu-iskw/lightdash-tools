import {
  OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CALLBACK_PATH,
  OAUTH_REGISTER_PATH,
  OAUTH_TOKEN_PATH,
} from '../../config/env.js';
import { isLocalHttpOrigin } from '../../config/normalize-url.js';
import { createOAuthBrokerStore } from '../../store/create-oauth-broker-store.js';
import { parseJsonBody, readBody } from '../../transports/http-body.js';
import { sendJson } from '../../transports/http-response.js';

import { buildBrokerAuthorizationServerMetadata } from './as-metadata.js';
import {
  buildLightdashAuthorizeUrl,
  exchangeLightdashAuthorizationCode,
} from './lightdash-token.js';
import { verifyPkce } from './pkce.js';

import type { IssuedAuthorizationCode, OAuthBrokerStore } from './pending-store.js';
import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Schemes that must never be used as OAuth redirect targets. */
const BLOCKED_REDIRECT_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

const AS_BUSY = {
  error: 'temporarily_unavailable',
  error_description: 'Authorization server busy; retry later',
} as const;

export interface OAuthBroker {
  handle: (req: IncomingMessage, res: ServerResponse, path: string) => Promise<boolean>;
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location }).end();
}

function readQuery(req: IncomingMessage): URLSearchParams {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  return url.searchParams;
}

function appendJsonValueToParams(params: URLSearchParams, key: string, value: unknown): void {
  if (typeof value === 'string') {
    params.set(key, value);
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    params.set(key, String(value));
    return;
  }

  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item === 'string') {
      params.append(key, item);
    }
  }
}

function jsonObjectToSearchParams(parsed: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    appendJsonValueToParams(params, key, value);
  }
  return params;
}

function readJsonFormParams(res: ServerResponse, rawBuf: Buffer): URLSearchParams | undefined {
  try {
    const parsed = parseJsonBody(rawBuf);
    if (parsed === undefined) return new URLSearchParams();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      sendJson(res, 400, { error: 'invalid_request', error_description: 'Invalid JSON body' });
      return undefined;
    }
    return jsonObjectToSearchParams(parsed as Record<string, unknown>);
  } catch {
    sendJson(res, 400, { error: 'invalid_request', error_description: 'Invalid JSON body' });
    return undefined;
  }
}

async function readFormOrJson(
  req: IncomingMessage,
  res: ServerResponse,
  maxBodyBytes: number,
): Promise<URLSearchParams | undefined> {
  const rawBuf = await readBody(req, res, maxBodyBytes);
  if (rawBuf === undefined) return undefined;
  if (rawBuf.length === 0) return new URLSearchParams();

  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    return readJsonFormParams(res, rawBuf);
  }

  return new URLSearchParams(rawBuf.toString('utf8'));
}

function isAllowedClientRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') return isLocalHttpOrigin(redirectUri);
    // Desktop / native custom schemes (cursor://, vscode://, …) — block dangerous ones.
    const scheme = url.protocol.toLowerCase();
    return !BLOCKED_REDIRECT_SCHEMES.has(scheme);
  } catch {
    return false;
  }
}

type AuthorizeParseFail = { ok: false; status: number; body: Record<string, string> };

async function parseRegisteredClientRedirect(
  query: URLSearchParams,
  store: OAuthBrokerStore,
): Promise<AuthorizeParseFail | { ok: true; clientId: string; redirectUri: string }> {
  const clientId = query.get('client_id');
  if (!clientId) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'client_id is required (register via /oauth/register first)',
      },
    };
  }

  if (!(await store.getClient(clientId))) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_client',
        error_description: 'Unknown client_id; register via /oauth/register first',
      },
    };
  }

  const redirectUri = query.get('redirect_uri');
  if (!redirectUri || !isAllowedClientRedirectUri(redirectUri)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description:
          'redirect_uri is required and must be https, localhost http, or a custom scheme',
      },
    };
  }

  if (!(await store.isRedirectAllowedForClient(clientId, redirectUri))) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'redirect_uri is not registered for this client_id',
      },
    };
  }

  return { ok: true, clientId, redirectUri };
}

async function parseAuthorizeRequest(
  query: URLSearchParams,
  store: OAuthBrokerStore,
): Promise<
  | AuthorizeParseFail
  | {
      ok: true;
      value: {
        clientId: string;
        redirectUri: string;
        clientState?: string;
        codeChallenge: string;
        resource?: string;
        scope?: string;
      };
    }
> {
  const responseType = query.get('response_type');
  if (responseType !== 'code') {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported',
      },
    };
  }

  const registered = await parseRegisteredClientRedirect(query, store);
  if (!registered.ok) {
    return registered;
  }

  const codeChallenge = query.get('code_challenge') ?? undefined;
  const method = (query.get('code_challenge_method') ?? 'S256').toUpperCase();
  if (!codeChallenge || method !== 'S256') {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'code_challenge with code_challenge_method=S256 is required',
      },
    };
  }

  return {
    ok: true,
    value: {
      clientId: registered.clientId,
      redirectUri: registered.redirectUri,
      clientState: query.get('state') ?? undefined,
      codeChallenge,
      resource: query.get('resource') ?? undefined,
      scope: query.get('scope') ?? undefined,
    },
  };
}

async function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<void> {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  const parsed = await parseAuthorizeRequest(readQuery(req), store);
  if (!parsed.ok) {
    sendJson(res, parsed.status, parsed.body);
    return;
  }

  const { clientId, redirectUri, clientState, codeChallenge, resource, scope } = parsed.value;
  const pending = await store.createPending({
    clientId,
    redirectUri,
    clientState,
    codeChallenge,
    codeChallengeMethod: 'S256',
    scope,
  });
  if (!pending) {
    sendJson(res, 503, { ...AS_BUSY });
    return;
  }

  redirect(
    res,
    buildLightdashAuthorizeUrl(config, {
      state: pending.brokerState,
      scope,
      resource,
    }),
  );
}

function redirectToClient(
  res: ServerResponse,
  redirectUri: string,
  params: Record<string, string | undefined>,
): void {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      target.searchParams.set(key, value);
    }
  }
  redirect(res, target.toString());
}

async function handleCallback(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<void> {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  const query = readQuery(req);
  const brokerState = query.get('state');
  if (!brokerState) {
    sendJson(res, 400, { error: 'invalid_request', error_description: 'Missing state' });
    return;
  }

  const pending = await store.takePending(brokerState);
  if (!pending) {
    sendJson(res, 400, { error: 'invalid_request', error_description: 'Unknown or expired state' });
    return;
  }

  const upstreamError = query.get('error');
  if (upstreamError) {
    redirectToClient(res, pending.redirectUri, {
      error: upstreamError,
      error_description: query.get('error_description') ?? undefined,
      state: pending.clientState,
    });
    return;
  }

  const code = query.get('code');
  if (!code) {
    sendJson(res, 400, { error: 'invalid_request', error_description: 'Missing code' });
    return;
  }

  try {
    const tokens = await exchangeLightdashAuthorizationCode(config, code);
    // Do not persist/return refresh_token: broker only supports authorization_code.
    const issued = await store.issueCode(pending, {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scope: tokens.scope,
    });
    if (!issued) {
      redirectToClient(res, pending.redirectUri, {
        ...AS_BUSY,
        state: pending.clientState,
      });
      return;
    }
    redirectToClient(res, pending.redirectUri, {
      code: issued.code,
      state: pending.clientState,
    });
  } catch (err) {
    console.error('OAuth broker callback token exchange failed:', err);
    redirectToClient(res, pending.redirectUri, {
      error: 'server_error',
      error_description: 'Upstream token exchange failed',
      state: pending.clientState,
    });
  }
}

type TokenGrantError = {
  status: number;
  body: { error: string; error_description: string };
};

async function validateTokenGrant(
  params: URLSearchParams,
  store: OAuthBrokerStore,
): Promise<TokenGrantError | { issued: IssuedAuthorizationCode }> {
  const grantType = params.get('grant_type');
  if (grantType !== 'authorization_code') {
    return {
      status: 400,
      body: {
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code is supported',
      },
    };
  }

  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId = params.get('client_id');
  const codeVerifier = params.get('code_verifier') ?? undefined;

  if (!code || !redirectUri || !clientId) {
    return {
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'code, redirect_uri, and client_id are required',
      },
    };
  }

  // Atomic take first (multi-instance safe). Restore on validation failure so a
  // bad verifier / redirect does not permanently burn a one-time code.
  const candidate = await store.takeCode(code);
  if (!candidate) {
    return {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid or expired code' },
    };
  }

  if (candidate.redirectUri !== redirectUri) {
    await store.restoreCode(candidate);
    return {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
    };
  }

  if (candidate.clientId !== clientId) {
    await store.restoreCode(candidate);
    return {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'client_id mismatch' },
    };
  }

  if (!verifyPkce(codeVerifier, candidate.codeChallenge, candidate.codeChallengeMethod)) {
    await store.restoreCode(candidate);
    return {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'PKCE verification failed' },
    };
  }

  return { issued: candidate };
}

async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  const params = await readFormOrJson(req, res, config.maxBodyBytes);
  if (!params) return;

  const grant = await validateTokenGrant(params, store);
  if ('status' in grant) {
    sendJson(res, grant.status, grant.body);
    return;
  }

  const { issued } = grant;
  sendJson(res, 200, {
    access_token: issued.accessToken,
    token_type: issued.tokenType,
    expires_in: issued.expiresIn ?? 3600,
    scope: issued.scope,
  });
}

async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  const params = await readFormOrJson(req, res, config.maxBodyBytes);
  if (!params) return;

  // Public MCP client DCR; confidential Lightdash credentials stay server-side.
  // JSON bodies expand array redirect_uris via readFormOrJson; form bodies use repeated keys.
  const redirectUris = params.getAll('redirect_uris');
  if (redirectUris.length === 0) {
    sendJson(res, 400, {
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris is required',
    });
    return;
  }

  for (const uri of redirectUris) {
    if (!isAllowedClientRedirectUri(uri)) {
      sendJson(res, 400, {
        error: 'invalid_redirect_uri',
        error_description:
          'Each redirect_uri must be https, localhost http, or a non-dangerous custom scheme',
      });
      return;
    }
  }

  const registered = await store.registerClient(redirectUris);
  if (!registered) {
    sendJson(res, 503, { ...AS_BUSY });
    return;
  }

  sendJson(res, 201, {
    client_id: registered.clientId,
    client_id_issued_at: Math.floor(registered.createdAt / 1000),
    redirect_uris: [...registered.redirectUris],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    client_name: params.get('client_name') ?? 'MCP Client',
  });
}

function handleAsMetadata(res: ServerResponse, config: McpHttpConfig): void {
  sendJson(res, 200, buildBrokerAuthorizationServerMetadata(config));
}

const BROKER_PATHS: ReadonlySet<string> = new Set([
  OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CALLBACK_PATH,
  OAUTH_TOKEN_PATH,
  OAUTH_REGISTER_PATH,
]);

/** True for co-located OAuth AS / broker paths (CORS may reflect any Origin). */
export function isOAuthBrokerPath(path: string): boolean {
  return BROKER_PATHS.has(path);
}

/**
 * Creates the OAuth broker request handler for co-located AS façade routes.
 * Uses the shared ephemeral store backend (memory default; Redis when configured).
 */
export function createOAuthBroker(
  config: McpHttpConfig,
  store: OAuthBrokerStore = createOAuthBrokerStore(),
): OAuthBroker {
  return {
    async handle(req, res, path): Promise<boolean> {
      if (!isOAuthBrokerPath(path)) {
        return false;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, { Allow: 'GET, POST, OPTIONS' }).end();
        return true;
      }

      if (path === OAUTH_AUTHORIZATION_SERVER_METADATA_PATH && req.method === 'GET') {
        handleAsMetadata(res, config);
        return true;
      }

      if (path === OAUTH_AUTHORIZE_PATH) {
        await handleAuthorize(req, res, config, store);
        return true;
      }

      if (path === OAUTH_CALLBACK_PATH) {
        await handleCallback(req, res, config, store);
        return true;
      }

      if (path === OAUTH_TOKEN_PATH) {
        await handleToken(req, res, config, store);
        return true;
      }

      if (path === OAUTH_REGISTER_PATH) {
        await handleRegister(req, res, config, store);
        return true;
      }

      return false;
    },
  };
}
