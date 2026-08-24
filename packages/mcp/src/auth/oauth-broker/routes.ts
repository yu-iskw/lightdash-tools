import { buildAuditLogEntry, logAuditEntry } from '@lightdash-tools/common';

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
import { parseJsonBody, readBody } from '../../transports/http-body.js';
import { sendHtml, sendJson, timingSafeEqualString } from '../../transports/http-response.js';

import { buildBrokerAuthorizationServerMetadata } from './as-metadata.js';
import { CONSENT_PAGE_HEADERS, renderConsentPage } from './consent-page.js';
import { allowedResourceOrigins, resourceOriginForRequest } from './invoke-origins.js';
import {
  buildLightdashAuthorizeUrl,
  exchangeLightdashAuthorizationCode,
} from './lightdash-token.js';
import { mintMcpAccessToken } from './mcp-access-token.js';
import {
  clientKeyFromRequest,
  InMemoryOAuthRateLimiter,
  type OAuthRateLimitAction,
} from './oauth-rate-limit.js';
import {
  InMemoryOAuthBrokerStore,
  type IssuedAuthorizationCode,
  type OAuthBrokerStore,
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

const UNREGISTERED_CLIENT_NAME = 'Unregistered MCP client';

function applyRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: InMemoryOAuthRateLimiter,
  action: OAuthRateLimitAction,
): boolean {
  const result = limiter.consume(action, clientKeyFromRequest(req.socket.remoteAddress));
  if (result.ok) {
    return true;
  }
  sendJson(
    res,
    429,
    {
      error: 'temporarily_unavailable',
      error_description: 'Too many requests; retry later',
    },
    { 'Retry-After': String(result.retryAfterSec) },
  );
  return false;
}

function publicOrigin(config: McpHttpConfig): string {
  return new URL(requirePublicUrl(config, 'OAuth consent Origin')).origin;
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const raw = req.headers.origin;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function originAllowed(req: IncomingMessage, config: McpHttpConfig): boolean {
  const origin = requestOrigin(req);
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).origin === publicOrigin(config);
  } catch {
    return false;
  }
}

function displayClientName(name: string | undefined): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : UNREGISTERED_CLIENT_NAME;
}

function auditConsent(status: 'success' | 'blocked'): void {
  const startMs = Date.now();
  logAuditEntry(
    buildAuditLogEntry({
      tool: 'oauth_consent',
      status,
      startMs,
    }),
  );
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
  config: McpHttpConfig,
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
      clientId: registered.clientId,
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

  const { clientId, redirectUri, clientState, codeChallenge, resource, scope } = parsed.value;
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

  const client = await store.getClient(clientId);
  const html = renderConsentPage({
    consentPath: OAUTH_CONSENT_PATH,
    brokerState: pending.brokerState,
    csrfToken: pending.csrfToken,
    clientId,
    clientName: displayClientName(client?.clientName),
    resource,
  });
  sendHtml(res, 200, html, CONSENT_PAGE_HEADERS);
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

  if (!pending.consented) {
    sendJson(res, 400, {
      error: 'access_denied',
      error_description: 'Authorization was not consented',
    });
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
    // The downstream credential remains server-side. The later MCP token endpoint
    // wraps it in an authenticated-encrypted, resource-bound broker token.
    // Refresh tokens are deliberately neither persisted nor returned.
    const issued = await store.issueCode(pending, {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
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

async function handleConsent(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  store: OAuthBrokerStore,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  if (!originAllowed(req, config)) {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'Origin does not match the MCP public URL',
    });
    return;
  }

  const params = await readFormOrJson(req, res, config.maxBodyBytes);
  if (!params) return;

  const brokerState = params.get('broker_state') ?? '';
  const csrfToken = params.get('csrf_token') ?? '';
  const decision = params.get('decision') ?? '';
  const pending = await store.getPending(brokerState);
  if (!pending || !timingSafeEqualString(csrfToken, pending.csrfToken)) {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'Invalid or expired consent request',
    });
    return;
  }

  if (decision === 'deny') {
    await store.takePending(brokerState);
    auditConsent('blocked');
    redirectToClient(res, pending.redirectUri, {
      error: 'access_denied',
      error_description: 'The user denied the authorization request',
      state: pending.clientState,
    });
    return;
  }

  if (decision !== 'approve') {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'decision must be approve or deny',
    });
    return;
  }

  const consented = await store.markConsented(brokerState);
  if (!consented) {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'Invalid or expired consent request',
    });
    return;
  }

  auditConsent('success');
  // MCP resource/scope stay on the client→broker leg. Do not forward them to Lightdash.
  redirect(res, buildLightdashAuthorizeUrl(config, { state: consented.brokerState }));
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
        handleAsMetadata(req, res, config);
        return true;
      }

      if (path === OAUTH_AUTHORIZE_PATH) {
        if (!applyRateLimit(req, res, limiter, 'authorize')) {
          return true;
        }
        await handleAuthorize(req, res, config, store);
        return true;
      }

      if (path === OAUTH_CONSENT_PATH) {
        if (!applyRateLimit(req, res, limiter, 'consent')) {
          return true;
        }
        await handleConsent(req, res, config, store);
        return true;
      }

      if (path === OAUTH_CALLBACK_PATH) {
        await handleCallback(req, res, config, store);
        return true;
      }

      if (path === OAUTH_TOKEN_PATH) {
        if (!applyRateLimit(req, res, limiter, 'token')) {
          return true;
        }
        await handleToken(req, res, config, store);
        return true;
      }

      if (path === OAUTH_REGISTER_PATH) {
        if (!applyRateLimit(req, res, limiter, 'register')) {
          return true;
        }
        await handleRegister(req, res, config, store);
        return true;
      }

      return false;
    },
  };
}
