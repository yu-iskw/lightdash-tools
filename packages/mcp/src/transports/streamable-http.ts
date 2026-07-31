import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

import { initAuditLog } from '../audit/audit.js';
import { runWithToolAuditAuthAsync } from '../audit/tool-audit-context.js';
import {
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  MCP_AUTH_MODE_NONE,
  MCP_AUTH_MODE_SHARED_KEY,
} from '../auth/auth-mode.js';
import {
  createOAuthBearerProvider,
  BearerContextProvider,
} from '../auth/bearer-context-provider.js';
import { EnvContextProvider } from '../auth/env-context-provider.js';
import {
  authenticateLightdashOAuth,
  writeOAuthAuthFailure,
} from '../auth/lightdash-oauth-middleware.js';
import { createOAuthBroker, type OAuthBroker } from '../auth/oauth-broker/routes.js';
import {
  buildOAuthProtectedResourceMetadata,
  getProtectedResourceMetadataPathUrl,
  getProtectedResourceMetadataUrl,
} from '../auth/oauth-protected-resource.js';
import { authenticateSharedKey, checkOrigin } from '../auth/shared-key-middleware.js';
import { hashToken } from '../auth/token-hash.js';
import { buildWwwAuthenticateHeader } from '../auth/www-authenticate.js';
import {
  getOAuthCallbackUrl,
  loadMcpHttpConfig,
  requiresLightdashApiKey,
  emitMcpHttpSecurityWarnings,
  type McpHttpConfig,
} from '../config/load-mcp-config.js';
import { getClient, getAuditLogPath } from '../config/runtime.js';
import { getPersonaByPath, listPersonaPaths } from '../personas/index.js';
import { extractPinnedProjectFromRequest, runWithProjectPinAsync } from '../project-pin.js';
import { createLightdashMcpServer } from '../server.js';

import { parseJsonBody, readBody, drainRequestBody } from './http-body.js';
import { isInitializeMessage } from './http-request-utils.js';
import {
  applyResponseHeaders,
  buildCorsHeaders,
  buildOAuthPublicCorsHeaders,
  sendJson,
} from './http-response.js';
import { SessionStore, type SessionEntry } from './session-store.js';

import type { PersonaDefinition } from '../personas/types.js';
import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

const ERROR_SESSION_NOT_FOUND = 'Session not found';

type OAuthRequest = IncomingMessage & {
  lightdashOAuth?: Awaited<ReturnType<typeof authenticateLightdashOAuth>> & { ok: true };
};

function listen(
  server: ReturnType<typeof createServer>,
  port: number,
  host: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function resolveListenHost(host: string): string {
  return host === '0.0.0.0' ? '127.0.0.1' : host;
}

function resolvePublicUrl(
  publicUrl: string | undefined,
  listenHost: string,
  listenPort: number,
): string {
  if (!publicUrl) {
    return `http://${listenHost}:${listenPort}`;
  }

  try {
    const url = new URL(publicUrl);
    if (url.port === '0') {
      url.port = String(listenPort);
      return url.origin;
    }
  } catch {
    // Fall through to the configured value when URL parsing fails.
  }

  return publicUrl;
}

function resolveHttpConfig(config: McpHttpConfig, listenPort: number): McpHttpConfig {
  const listenHost = resolveListenHost(config.host);
  return {
    ...config,
    publicUrl: resolvePublicUrl(config.publicUrl, listenHost, listenPort),
  };
}

function getSessionId(req: IncomingMessage): string | undefined {
  const sessionId = req.headers['mcp-session-id'];
  return typeof sessionId === 'string' ? sessionId : sessionId?.[0];
}

function createEnvContextProvider(config: McpHttpConfig): McpContextProvider {
  return new EnvContextProvider({
    mode:
      config.authMode === MCP_AUTH_MODE_SHARED_KEY ? MCP_AUTH_MODE_SHARED_KEY : MCP_AUTH_MODE_NONE,
    client: getClient(),
  });
}

function closeSessionEntry(entry: SessionEntry, sessionId: string, reason: string): void {
  void Promise.all([entry.transport.close(), entry.server.close()]).catch((err: unknown) => {
    console.error(`Failed to close MCP session ${sessionId} (${reason}):`, err);
  });
}

function createSessionTransport(
  contextProvider: McpContextProvider,
  sessionStore: SessionStore,
  auth: {
    mode: McpHttpConfig['authMode'];
    tokenHash?: string;
    subject?: string;
    organizationUuid?: string;
  },
  persona: PersonaDefinition,
): NodeStreamableHTTPServerTransport {
  const holder: { server: McpServer } = {
    server: createLightdashMcpServer(contextProvider, { persona }),
  };
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessionStore.set(sessionId, {
        transport,
        server: holder.server,
        lastAccessAt: Date.now(),
        auth: {
          mode: auth.mode,
          tokenHash: auth.tokenHash,
          subject: auth.subject,
          organizationUuid: auth.organizationUuid,
        },
        contextProvider,
        personaId: persona.id,
      });
    },
    onsessionclosed: (sessionId) => {
      const entry = sessionStore.get(sessionId);
      sessionStore.delete(sessionId);
      if (entry) {
        closeSessionEntry(entry, sessionId, 'closed');
      }
    },
  });

  holder.server.connect(transport).catch((err) => {
    console.error('MCP server connect error:', err);
  });

  return transport;
}

function handleHealth(path: string, res: ServerResponse, config: McpHttpConfig): void {
  if (path === '/health/live') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  try {
    if (requiresLightdashApiKey(config.authMode)) {
      getClient();
    }
    sendJson(res, 200, { status: 'ready' });
  } catch {
    sendJson(res, 503, { status: 'not ready' });
  }
}

function handleMetadata(path: string, res: ServerResponse, config: McpHttpConfig): boolean {
  const rootMetadataPath = '/.well-known/oauth-protected-resource';
  const pathMetadataUrl = getProtectedResourceMetadataPathUrl(config);
  const pathSpecificMetadataPath = new URL(pathMetadataUrl).pathname;

  if (path !== rootMetadataPath && path !== pathSpecificMetadataPath) {
    return false;
  }

  sendJson(res, 200, buildOAuthProtectedResourceMetadata(config));
  return true;
}

async function ensureEndpointAuth(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
): Promise<boolean> {
  if (config.authMode === MCP_AUTH_MODE_NONE) {
    return true;
  }

  if (config.authMode === MCP_AUTH_MODE_SHARED_KEY) {
    const result = authenticateSharedKey(req, config);
    if (!result.ok) {
      sendJson(res, result.status, result.body);
      return false;
    }
    return true;
  }

  const result = await authenticateLightdashOAuth(req, config);
  if (!result.ok) {
    writeOAuthAuthFailure(res, result);
    return false;
  }

  (req as OAuthRequest).lightdashOAuth = result;
  return true;
}

function writeBearerTokenRequiredFailure(res: ServerResponse, config: McpHttpConfig): void {
  writeOAuthAuthFailure(res, {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_request',
      error_description: 'Bearer access token required',
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({
      resourceMetadataUrl: getProtectedResourceMetadataPathUrl(config),
      scope: config.requiredScopes.join(' '),
    }),
  });
}

function writeSessionContextMismatch(
  res: ServerResponse,
  config: McpHttpConfig,
  errorDescription: string,
): void {
  writeOAuthAuthFailure(res, {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_token',
      error_description: errorDescription,
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({
      resourceMetadataUrl: getProtectedResourceMetadataPathUrl(config),
      scope: config.requiredScopes.join(' '),
      error: 'invalid_token',
      errorDescription,
    }),
  });
}

function getOAuthAuditContext(req: IncomingMessage): {
  tokenHash?: string;
  subject?: string;
} {
  const oauth = (req as OAuthRequest).lightdashOAuth;
  if (!oauth?.ok) {
    return {};
  }

  return {
    tokenHash: hashToken(oauth.accessToken),
    subject: oauth.user.userUuid,
  };
}

function verifySessionAuth(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  entry: SessionEntry | undefined,
): boolean {
  if (!entry || config.authMode !== MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    return true;
  }

  const oauth = (req as OAuthRequest).lightdashOAuth;
  if (!oauth?.accessToken) {
    writeBearerTokenRequiredFailure(res, config);
    return false;
  }

  if (entry.auth.subject && entry.auth.subject !== oauth.user.userUuid) {
    writeSessionContextMismatch(res, config, 'Session subject mismatch');
    return false;
  }

  const previousOrg = entry.auth.organizationUuid ?? null;
  const nextOrg = oauth.user.organizationUuid ?? null;
  if (previousOrg !== nextOrg) {
    writeSessionContextMismatch(res, config, 'Session organization mismatch');
    return false;
  }

  const nextTokenHash = hashToken(oauth.accessToken);
  if (entry.auth.tokenHash !== nextTokenHash) {
    entry.auth.tokenHash = nextTokenHash;
    if (entry.contextProvider instanceof BearerContextProvider) {
      entry.contextProvider.updateAccessToken(oauth.accessToken);
    }
  }

  return true;
}

interface SessionRequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  config: McpHttpConfig;
  sessionStore: SessionStore;
  persona: PersonaDefinition;
}

async function handleExistingSessionPost(
  ctx: SessionRequestContext,
  sid: string,
  body: unknown,
): Promise<void> {
  const { req, res, config, sessionStore, persona } = ctx;
  const entry = sessionStore.get(sid);
  if (!entry) {
    sendJson(res, 404, { error: ERROR_SESSION_NOT_FOUND });
    return;
  }
  if (entry.personaId !== persona.id) {
    sendJson(res, 404, { error: ERROR_SESSION_NOT_FOUND });
    return;
  }
  if (!verifySessionAuth(req, res, config, entry)) return;
  sessionStore.touch(sid);
  const auditAuth = getOAuthAuditContext(req);
  await runWithToolAuditAuthAsync(
    {
      tokenHash: auditAuth.tokenHash ?? entry.auth.tokenHash,
      subject: auditAuth.subject ?? entry.auth.subject,
    },
    () => entry.transport.handleRequest(req, res, body),
  );
}

async function handleInitializePost(ctx: SessionRequestContext, body: unknown): Promise<void> {
  const { req, res, config, sessionStore, persona } = ctx;
  const oauth =
    config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH
      ? (req as OAuthRequest).lightdashOAuth
      : undefined;
  const sessionSubject = oauth?.ok ? oauth.user.userUuid : undefined;

  if (
    !sessionStore.canAcceptNewSession(sessionSubject, (entry, sessionId) => {
      closeSessionEntry(entry, sessionId, 'expired');
    })
  ) {
    sendJson(res, 503, { error: 'Service Unavailable: max sessions reached' });
    return;
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    if (!oauth?.ok) {
      writeBearerTokenRequiredFailure(res, config);
      return;
    }

    const contextProvider = createOAuthBearerProvider(config, {
      accessToken: oauth.accessToken,
      subject: oauth.user.userUuid,
    });

    const transport = createSessionTransport(
      contextProvider,
      sessionStore,
      {
        mode: MCP_AUTH_MODE_LIGHTDASH_OAUTH,
        tokenHash: contextProvider.getTokenHash(),
        subject: oauth.user.userUuid,
        organizationUuid: oauth.user.organizationUuid,
      },
      persona,
    );
    await runWithToolAuditAuthAsync(
      {
        tokenHash: contextProvider.getTokenHash(),
        subject: oauth.user.userUuid,
      },
      () => transport.handleRequest(req, res, body),
    );
    return;
  }

  const transport = createSessionTransport(
    createEnvContextProvider(config),
    sessionStore,
    {
      mode: config.authMode,
    },
    persona,
  );
  await transport.handleRequest(req, res, body);
}

async function handleMcpPost(ctx: SessionRequestContext, sid: string | undefined): Promise<void> {
  const { req, res, config } = ctx;
  if (
    config.authMode === MCP_AUTH_MODE_SHARED_KEY ||
    config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH
  ) {
    if (!(await ensureEndpointAuth(req, res, config))) {
      drainRequestBody(req);
      return;
    }
  }

  const raw = await readBody(req, res, config.maxBodyBytes);
  if (raw === undefined) return;

  let body: unknown;
  if (raw.length > 0) {
    try {
      body = parseJsonBody(raw);
    } catch {
      sendJson(res, 400, { error: 'Bad Request: invalid JSON body' });
      return;
    }
  }

  if (sid) {
    await handleExistingSessionPost(ctx, sid, body);
    return;
  }

  if (body !== undefined && isInitializeMessage(body)) {
    await handleInitializePost(ctx, body);
    return;
  }

  sendJson(res, 400, {
    error: 'Bad Request: Mcp-Session-Id required for non-initialize requests',
  });
}

async function handleMcpGetOrDelete(
  ctx: SessionRequestContext,
  sid: string | undefined,
): Promise<void> {
  const { req, res, config, sessionStore, persona } = ctx;
  if (!sid) {
    sendJson(res, 400, { error: 'Bad Request: Mcp-Session-Id required' });
    return;
  }

  if (config.authMode !== MCP_AUTH_MODE_NONE) {
    if (!(await ensureEndpointAuth(req, res, config))) return;
  }

  const entry = sessionStore.get(sid);
  if (!entry || entry.personaId !== persona.id) {
    sendJson(res, 404, { error: ERROR_SESSION_NOT_FOUND });
    return;
  }

  if (!verifySessionAuth(req, res, config, entry)) return;

  sessionStore.touch(sid);
  const auditAuth = getOAuthAuditContext(req);
  await runWithToolAuditAuthAsync(
    {
      tokenHash: auditAuth.tokenHash ?? entry.auth.tokenHash,
      subject: auditAuth.subject ?? entry.auth.subject,
    },
    () => entry.transport.handleRequest(req, res),
  );
}

export interface StreamableHttpServerHandle {
  port: number;
  baseUrl: string;
  config: McpHttpConfig;
  close: () => Promise<void>;
}

export async function createStreamableHttpServer(
  config?: McpHttpConfig,
): Promise<StreamableHttpServerHandle> {
  const inputConfig = config ?? loadMcpHttpConfig();

  emitMcpHttpSecurityWarnings(inputConfig);

  initAuditLog(getAuditLogPath());

  const sessionStore = new SessionStore(
    inputConfig.sessionTtlMs,
    inputConfig.maxSessions,
    inputConfig.maxSessionsPerSubject,
  );
  let httpConfig = inputConfig;

  const cleanupTimer = setInterval(() => {
    sessionStore.cleanupExpired((entry, sessionId) => {
      closeSessionEntry(entry, sessionId, 'expired');
    });
  }, inputConfig.sessionCleanupMs);
  cleanupTimer.unref();

  let oauthBroker: OAuthBroker | undefined;

  const server = createServer((req, res) => {
    handleHttpRequest(req, res, httpConfig, sessionStore, oauthBroker).catch((err) => {
      console.error('MCP HTTP handler error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal Server Error' });
      }
    });
  });

  await listen(server, inputConfig.port, inputConfig.host);

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : inputConfig.port;
  httpConfig = resolveHttpConfig(inputConfig, port);
  const baseUrl = httpConfig.publicUrl ?? `http://${resolveListenHost(httpConfig.host)}:${port}`;
  if (httpConfig.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    oauthBroker = createOAuthBroker(httpConfig);
  }

  return {
    port,
    baseUrl,
    config: httpConfig,
    close: () =>
      new Promise<void>((resolve, reject) => {
        clearInterval(cleanupTimer);
        sessionStore.drainAll((entry, sessionId) => {
          closeSessionEntry(entry, sessionId, 'shutdown');
        });
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

export function startStreamableHttpServer(config?: McpHttpConfig): void {
  void createStreamableHttpServer(config)
    .then(({ baseUrl, config: httpConfig }) => {
      const paths = listPersonaPaths()
        .map((p) => `${baseUrl}${p}`)
        .join(', ');
      console.error(`Lightdash MCP server listening on ${paths} (auth: ${httpConfig.authMode})`);
      if (httpConfig.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
        console.error(`OAuth PRM: ${getProtectedResourceMetadataUrl(httpConfig)}`);
        console.error(`OAuth callback (register in Lightdash): ${getOAuthCallbackUrl(httpConfig)}`);
      }
    })
    .catch((err: unknown) => {
      console.error('Failed to start MCP HTTP server:', err);
      process.exit(1);
    });
}

/** Applies CORS reflect headers when the Origin is allowlisted (never blocks). */
function applyOptionalCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyResponseHeaders(res, buildCorsHeaders(origin, config.allowedOrigins));
}

/** CORS for OAuth AS / discovery: reflect any Origin so loopback clients can read token JSON. */
function applyOAuthPublicCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyResponseHeaders(res, buildOAuthPublicCorsHeaders(origin));
}

/**
 * Validates Origin and applies CORS headers for persona MCP routes.
 * Short-circuits OPTIONS preflight with 204; returns true when the request is fully handled.
 */
function applyOriginGuardAndCors(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (!checkOrigin(origin, config.allowedOrigins)) {
    sendJson(res, 403, { error: 'Forbidden: origin not allowed' });
    return true;
  }

  const corsHeaders = buildCorsHeaders(origin, config.allowedOrigins);
  applyResponseHeaders(res, corsHeaders);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders).end();
    return true;
  }

  return false;
}

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  oauthBroker: OAuthBroker | undefined,
): Promise<void> {
  const path = (req.url ?? '').split('?')[0] ?? '';

  // Public discovery / health / OAuth broker: do not Origin-block (empty allowlist must not 403).
  if (path === '/health/live' || path === '/health/ready') {
    applyOptionalCorsHeaders(req, res, config);
    handleHealth(path, res, config);
    return;
  }

  if (oauthBroker) {
    applyOAuthPublicCorsHeaders(req, res);
    if (await oauthBroker.handle(req, res, path)) {
      return;
    }
  } else if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    applyOAuthPublicCorsHeaders(req, res);
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && handleMetadata(path, res, config)) {
    return;
  }

  // Persona MCP routes: Origin allowlist is enforced (CSRF / browser blast-radius).
  if (applyOriginGuardAndCors(req, res, config)) {
    return;
  }

  const persona = getPersonaByPath(path);
  if (!persona) {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const sid = getSessionId(req);
  const pinnedProjectUuid = extractPinnedProjectFromRequest(req);

  await runWithProjectPinAsync(pinnedProjectUuid, async () => {
    if (req.method === 'POST') {
      await handleMcpPost({ req, res, config, sessionStore, persona }, sid);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      await handleMcpGetOrDelete({ req, res, config, sessionStore, persona }, sid);
      return;
    }

    res.writeHead(405, { Allow: 'GET, POST, DELETE' }).end();
  });
}
