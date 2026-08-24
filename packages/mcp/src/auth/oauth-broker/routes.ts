import { listEnabledProfilePaths } from '../../config/enabled-profiles.js';
import {
  OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CALLBACK_PATH,
  OAUTH_CONSENT_PATH,
  OAUTH_REGISTER_PATH,
  OAUTH_TOKEN_PATH,
} from '../../config/env.js';
import { isLocalHttpOrigin } from '../../config/normalize-url.js';
import { requirePublicUrl } from '../../config/public-url.js';
import { sendHtml, sendJson, sendRedirectWithQuery } from '../../transports/http-response.js';

import { buildBrokerAuthorizationServerMetadata } from './as-metadata.js';
import { CONSENT_PAGE_HEADERS, displayClientName, renderConsentPage } from './consent-page.js';
import { handleConsent } from './consent.js';
import { allowedResourceOrigins, resourceOriginForRequest } from './invoke-origins.js';
import { exchangeLightdashAuthorizationCode } from './lightdash-token.js';
import { mintMcpAccessToken } from './mcp-access-token.js';
import { readFormOrJson } from './oauth-form.js';
import {
  clientKeyFromRequest,
  InMemoryOAuthRateLimiter,
  type OAuthRateLimitAction,
} from './oauth-rate-limit.js';
import {
  InMemoryOAuthBrokerStore,
  type IssuedAuthorizationCode,
  type OAuthBrokerStore,
  type RegisteredClient,
} from './pending-store.js';
import { verifyPkce } from './pkce.js';

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

function readQuery(req: IncomingMessage): URLSearchParams {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  return url.searchParams;
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

function canonicalProfileResource(resource: string): string | undefined {
  try {
    const url = new URL(resource);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      return undefined;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function allowedMcpResource(config: McpHttpConfig, resource: string): string | undefined {
  const canonical = canonicalProfileResource(resource);
  if (canonical === undefined) {
    return undefined;
  }
  const profilePaths = listEnabledProfilePaths(config.enabledProfiles);
  const origins = allowedResourceOrigins(
    requirePublicUrl(config, 'OAuth resource validation'),
    config.invokeOrigins,
  );
  const allowed = origins.some((origin) =>
    profilePaths.some((profilePath) => canonical === `${origin}${profilePath}`),
  );
  return allowed ? canonical : undefined;
}

type AuthorizeParseFail = { ok: false; status: number; body: Record<string, string> };

async function parseRegisteredClientRedirect(
  query: URLSearchParams,
  store: OAuthBrokerStore,
): Promise<AuthorizeParseFail | { ok: true; client: RegisteredClient; redirectUri: string }> {
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

  const client = await store.getClient(clientId);
  if (!client) {
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

  if (!client.redirectUris.has(redirectUri)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'redirect_uri is not registered for this client_id',
      },
    };
  }

  return { ok: true, client, redirectUri };
}

async function parseAuthorizeRequest(
  query: URLSearchParams,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<
  | AuthorizeParseFail
  | {
      ok: true;
      value: {
        clientId: string;
        clientName: string;
        redirectUri: string;
        clientState?: string;
        codeChallenge: string;
        resource: string;
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

  const resources = query.getAll('resource');
  if (resources.length !== 1 || resources[0]!.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'Exactly one MCP resource parameter is required',
      },
    };
  }
  const resource = resources[0]!;
  const allowedResource = allowedMcpResource(config, resource);
  if (allowedResource === undefined) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'invalid_target',
        error_description: 'resource must identify an enabled MCP profile endpoint',
      },
    };
  }

  return {
    ok: true,
    value: {
      clientId: registered.client.clientId,
      clientName: displayClientName(registered.client.clientName),
      redirectUri: registered.redirectUri,
      clientState: query.get('state') ?? undefined,
      codeChallenge,
      resource: allowedResource,
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

  const parsed = await parseAuthorizeRequest(readQuery(req), config, store);
  if (!parsed.ok) {
    sendJson(res, parsed.status, parsed.body);
    return;
  }

  const { clientId, clientName, redirectUri, clientState, codeChallenge, resource, scope } =
    parsed.value;
  const pending = await store.createPending({
    clientId,
    redirectUri,
    clientState,
    codeChallenge,
    codeChallengeMethod: 'S256',
    resource,
    scope,
  });
  if (!pending) {
    sendJson(res, 503, { ...AS_BUSY });
    return;
  }

  const html = renderConsentPage({
    consentPath: OAUTH_CONSENT_PATH,
    brokerState: pending.brokerState,
    csrfToken: pending.csrfToken,
    clientId,
    clientName,
    resource,
  });
  sendHtml(res, 200, html, CONSENT_PAGE_HEADERS);
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

  if (!pending.consented) {
    sendJson(res, 400, {
      error: 'access_denied',
      error_description: 'Authorization was not consented',
    });
    return;
  }

  const upstreamError = query.get('error');
  if (upstreamError) {
    sendRedirectWithQuery(res, pending.redirectUri, {
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
    // The downstream credential remains server-side. The later MCP token endpoint
    // wraps it in an authenticated-encrypted, resource-bound broker token.
    // Refresh tokens are deliberately neither persisted nor returned.
    const issued = await store.issueCode(pending, {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
    });
    if (!issued) {
      sendRedirectWithQuery(res, pending.redirectUri, {
        ...AS_BUSY,
        state: pending.clientState,
      });
      return;
    }
    sendRedirectWithQuery(res, pending.redirectUri, {
      code: issued.code,
      state: pending.clientState,
    });
  } catch (err) {
    console.error('OAuth broker callback token exchange failed:', err);
    sendRedirectWithQuery(res, pending.redirectUri, {
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

type TokenGrantRequest = {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string | undefined;
  resource: string;
};

function parseTokenGrantRequest(params: URLSearchParams): TokenGrantError | TokenGrantRequest {
  if (params.get('grant_type') !== 'authorization_code') {
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
  const resources = params.getAll('resource');
  const resource = resources.length === 1 ? resources[0] : undefined;

  if (!code || !redirectUri || !clientId || !resource) {
    return {
      status: 400,
      body: {
        error: 'invalid_request',
        error_description: 'code, redirect_uri, client_id, and exactly one resource are required',
      },
    };
  }

  return { code, redirectUri, clientId, codeVerifier, resource };
}

function invalidGrant(description: string): TokenGrantError {
  return {
    status: 400,
    body: { error: 'invalid_grant', error_description: description },
  };
}

async function validateTokenGrant(
  params: URLSearchParams,
  store: OAuthBrokerStore,
): Promise<TokenGrantError | { issued: IssuedAuthorizationCode }> {
  const request = parseTokenGrantRequest(params);
  if ('status' in request) return request;

  // Atomic take first. Do not restore on mismatch — a redemption attempt burns the code.
  const candidate = await store.takeCode(request.code);
  if (!candidate) {
    return {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid or expired code' },
    };
  }

  if (candidate.redirectUri !== request.redirectUri) {
    return invalidGrant('redirect_uri mismatch');
  }

  if (candidate.clientId !== request.clientId) {
    return invalidGrant('client_id mismatch');
  }

  if (candidate.resource !== canonicalProfileResource(request.resource)) {
    return invalidGrant('resource mismatch');
  }

  if (!verifyPkce(request.codeVerifier, candidate.codeChallenge, candidate.codeChallengeMethod)) {
    return invalidGrant('PKCE verification failed');
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
  const upstreamLifetimeSeconds = issued.expiresIn ?? 3600;
  const expiresAtMs = issued.createdAt + upstreamLifetimeSeconds * 1000;

  try {
    const minted = mintMcpAccessToken(config, {
      lightdashAccessToken: issued.accessToken,
      clientId: issued.clientId,
      resource: issued.resource,
      scope: issued.scope,
      expiresAtMs,
    });
    sendJson(res, 200, {
      access_token: minted.accessToken,
      token_type: 'Bearer',
      expires_in: minted.expiresIn,
      scope: issued.scope,
    });
  } catch {
    sendJson(res, 400, {
      error: 'invalid_grant',
      error_description: 'Upstream Lightdash credential expired before broker token issuance',
    });
  }
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

  const clientName = params.get('client_name') ?? undefined;
  const registered = await store.registerClient(redirectUris, clientName);
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
    client_name: displayClientName(registered.clientName),
  });
}

function handleAsMetadata(req: IncomingMessage, res: ServerResponse, config: McpHttpConfig): void {
  sendJson(
    res,
    200,
    buildBrokerAuthorizationServerMetadata(
      config,
      resourceOriginForRequest(
        req,
        config.invokeOrigins,
        requirePublicUrl(config, 'OAuth resource origin'),
      ),
    ),
  );
}

const BROKER_PATHS: ReadonlySet<string> = new Set([
  OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CALLBACK_PATH,
  OAUTH_CONSENT_PATH,
  OAUTH_TOKEN_PATH,
  OAUTH_REGISTER_PATH,
]);

/** True for co-located OAuth AS / broker paths (CORS may reflect any Origin). */
export function isOAuthBrokerPath(path: string): boolean {
  return BROKER_PATHS.has(path);
}

async function runRateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: InMemoryOAuthRateLimiter,
  action: OAuthRateLimitAction,
  run: () => Promise<void>,
): Promise<void> {
  const result = limiter.consume(action, clientKeyFromRequest(req.socket.remoteAddress));
  if (!result.ok) {
    sendJson(
      res,
      429,
      {
        error: 'temporarily_unavailable',
        error_description: 'Too many requests; retry later',
      },
      { 'Retry-After': String(result.retryAfterSec) },
    );
    return;
  }
  await run();
}

async function dispatchOAuthBroker(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  ctx: {
    config: McpHttpConfig;
    expectedOrigin: string;
    limiter: InMemoryOAuthRateLimiter;
    store: OAuthBrokerStore;
  },
): Promise<boolean> {
  const { config, expectedOrigin, limiter, store } = ctx;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { Allow: 'GET, POST, OPTIONS' }).end();
    return true;
  }

  if (path === OAUTH_AUTHORIZATION_SERVER_METADATA_PATH && req.method === 'GET') {
    handleAsMetadata(req, res, config);
    return true;
  }

  if (path === OAUTH_AUTHORIZE_PATH) {
    await runRateLimited(req, res, limiter, 'authorize', () =>
      handleAuthorize(req, res, config, store),
    );
    return true;
  }

  if (path === OAUTH_CONSENT_PATH) {
    await runRateLimited(req, res, limiter, 'consent', () =>
      handleConsent(req, res, { config, expectedOrigin, store }),
    );
    return true;
  }

  if (path === OAUTH_CALLBACK_PATH) {
    await handleCallback(req, res, config, store);
    return true;
  }

  if (path === OAUTH_TOKEN_PATH) {
    await runRateLimited(req, res, limiter, 'token', () => handleToken(req, res, config, store));
    return true;
  }

  if (path === OAUTH_REGISTER_PATH) {
    await runRateLimited(req, res, limiter, 'register', () =>
      handleRegister(req, res, config, store),
    );
    return true;
  }

  return false;
}

/**
 * Creates the OAuth broker request handler for co-located AS façade routes.
 * Pending authorization/code state is process-local, so `/oauth/*` still needs
 * sticky routing or one replica. Issued MCP access tokens are self-contained.
 */
export function createOAuthBroker(
  config: McpHttpConfig,
  store: OAuthBrokerStore = new InMemoryOAuthBrokerStore(),
  limiter: InMemoryOAuthRateLimiter = new InMemoryOAuthRateLimiter(),
): OAuthBroker {
  const expectedOrigin = new URL(requirePublicUrl(config, 'OAuth consent Origin')).origin;
  return {
    async handle(req, res, path): Promise<boolean> {
      if (!isOAuthBrokerPath(path)) {
        return false;
      }
      return dispatchOAuthBroker(req, res, path, { config, expectedOrigin, limiter, store });
    },
  };
}
