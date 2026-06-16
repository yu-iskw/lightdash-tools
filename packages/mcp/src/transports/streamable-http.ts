import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { initAuditLog } from '../audit.js';
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
import {
  buildOAuthProtectedResourceMetadata,
  getProtectedResourceMetadataPathUrl,
  getProtectedResourceMetadataUrl,
} from '../auth/oauth-protected-resource.js';
import { authenticateSharedKey, checkOrigin } from '../auth/shared-key-middleware.js';
import { hashToken } from '../auth/token-hash.js';
import { buildWwwAuthenticateHeader } from '../auth/www-authenticate.js';
import {
  loadMcpHttpConfig,
  requiresLightdashApiKey,
  emitMcpHttpSecurityWarnings,
  type McpHttpConfig,
} from '../config/load-mcp-config.js';
import { getAuditLogPath, getClient } from '../config.js';
import { createLightdashMcpServer } from '../server.js';
import { runWithToolAuditAuthAsync } from '../tool-audit-context.js';

import { parseJsonBody, readBody, drainRequestBody } from './http-body.js';
import { isInitializeMessage } from './http-request-utils.js';
import { applyResponseHeaders, buildCorsHeaders, sendJson } from './http-response.js';
import { SessionStore, type SessionEntry } from './session-store.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

function resolveHttpConfig(config: McpHttpConfig, listenPort: number): McpHttpConfig {
  const listenHost = resolveListenHost(config.host);
  return {
    ...config,
    publicUrl: config.publicUrl ?? `http://${listenHost}:${listenPort}`,
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
  auth: { mode: McpHttpConfig['authMode']; tokenHash?: string; subject?: string },
): StreamableHTTPServerTransport {
  const holder: { server: McpServer } = {
    server: createLightdashMcpServer(contextProvider),
  };
  const transport = new StreamableHTTPServerTransport({
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
        },
        contextProvider,
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

function writeSessionSubjectMismatch(res: ServerResponse, config: McpHttpConfig): void {
  writeOAuthAuthFailure(res, {
    ok: false,
    status: 401,
    body: {
      error: 'invalid_token',
      error_description: 'Session subject mismatch',
    },
    wwwAuthenticate: buildWwwAuthenticateHeader({
      resourceMetadataUrl: getProtectedResourceMetadataPathUrl(config),
      scope: config.requiredScopes.join(' '),
      error: 'invalid_token',
      errorDescription: 'Session subject mismatch',
    }),
  });
}

function getOAuthAuditContext(req: IncomingMessage): {
  tokenHash?: string;
  subject?: string;
  scopes?: string[];
} {
  const oauth = (req as OAuthRequest).lightdashOAuth;
  if (!oauth?.ok) {
    return {};
  }

  return {
    tokenHash: hashToken(oauth.accessToken),
    subject: oauth.user.userUuid,
    scopes: oauth.scopes,
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
    return false;
  }

  if (entry.auth.subject && entry.auth.subject !== oauth.user.userUuid) {
    writeSessionSubjectMismatch(res, config);
    return false;
  }

  const nextTokenHash = hashToken(oauth.accessToken);
  if (entry.auth.tokenHash !== nextTokenHash) {
    entry.auth.tokenHash = nextTokenHash;
    if (entry.contextProvider instanceof BearerContextProvider) {
      entry.contextProvider.updateAccessToken(oauth.accessToken, oauth.scopes);
    }
  }

  return true;
}

interface SessionRequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  config: McpHttpConfig;
  sessionStore: SessionStore;
}

async function handleExistingSessionPost(
  ctx: SessionRequestContext,
  sid: string,
  body: unknown,
): Promise<void> {
  const { req, res, config, sessionStore } = ctx;
  const entry = sessionStore.get(sid);
  if (!entry) {
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
      scopes: auditAuth.scopes,
    },
    () => entry.transport.handleRequest(req, res, body),
  );
}

async function handleInitializePost(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  body: unknown,
): Promise<void> {
  if (
    !sessionStore.canAcceptNewSession((entry, sessionId) => {
      closeSessionEntry(entry, sessionId, 'expired');
    })
  ) {
    sendJson(res, 503, { error: 'Service Unavailable: max sessions reached' });
    return;
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    const oauth = (req as OAuthRequest).lightdashOAuth;
    if (!oauth?.ok) {
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
      return;
    }

    const contextProvider = createOAuthBearerProvider(config, {
      accessToken: oauth.accessToken,
      subject: oauth.user.userUuid,
      scopes: oauth.scopes,
    });

    const transport = createSessionTransport(contextProvider, sessionStore, {
      mode: MCP_AUTH_MODE_LIGHTDASH_OAUTH,
      tokenHash: contextProvider.getTokenHash(),
      subject: oauth.user.userUuid,
    });
    await runWithToolAuditAuthAsync(
      {
        tokenHash: contextProvider.getTokenHash(),
        subject: oauth.user.userUuid,
        scopes: oauth.scopes,
      },
      () => transport.handleRequest(req, res, body),
    );
    return;
  }

  const transport = createSessionTransport(createEnvContextProvider(config), sessionStore, {
    mode: config.authMode,
  });
  await transport.handleRequest(req, res, body);
}

function requiresProtectedEndpointAuth(config: McpHttpConfig): boolean {
  return (
    config.authMode === MCP_AUTH_MODE_SHARED_KEY ||
    config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH
  );
}

async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  sid: string | undefined,
): Promise<void> {
  if (requiresProtectedEndpointAuth(config)) {
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
    await handleExistingSessionPost({ req, res, config, sessionStore }, sid, body);
    return;
  }

  if (body !== undefined && isInitializeMessage(body)) {
    await handleInitializePost(req, res, config, sessionStore, body);
    return;
  }

  sendJson(res, 400, {
    error: 'Bad Request: Mcp-Session-Id required for non-initialize requests',
  });
}

async function handleMcpGetOrDelete(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  sid: string | undefined,
): Promise<void> {
  if (!sid) {
    sendJson(res, 400, { error: 'Bad Request: Mcp-Session-Id required' });
    return;
  }

  if (config.authMode !== MCP_AUTH_MODE_NONE) {
    if (!(await ensureEndpointAuth(req, res, config))) return;
  }

  const entry = sessionStore.get(sid);
  if (!entry) {
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
      scopes: auditAuth.scopes,
    },
    () => entry.transport.handleRequest(req, res),
  );
}

export interface StreamableHttpServerHandle {
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function createStreamableHttpServer(
  config?: McpHttpConfig,
): Promise<StreamableHttpServerHandle> {
  const inputConfig = config ?? loadMcpHttpConfig();

  emitMcpHttpSecurityWarnings(inputConfig);

  initAuditLog(getAuditLogPath());

  const sessionStore = new SessionStore(inputConfig.sessionTtlMs, inputConfig.maxSessions);
  let httpConfig = inputConfig;

  const cleanupTimer = setInterval(() => {
    sessionStore.cleanupExpired((entry, sessionId) => {
      closeSessionEntry(entry, sessionId, 'expired');
    });
  }, inputConfig.sessionCleanupMs);
  cleanupTimer.unref();

  const server = createServer((req, res) => {
    handleHttpRequest(req, res, httpConfig, sessionStore).catch((err) => {
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
  const baseUrl = httpConfig.publicUrl!;

  return {
    port,
    baseUrl,
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
    .then(({ baseUrl }) => {
      const httpConfig = config ?? loadMcpHttpConfig();
      console.error(
        `Lightdash MCP server listening on ${baseUrl}${httpConfig.mcpPath} (auth: ${httpConfig.authMode})`,
      );
      if (httpConfig.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
        const metadataConfig = httpConfig.publicUrl
          ? httpConfig
          : { ...httpConfig, publicUrl: baseUrl };
        console.error(`OAuth metadata: ${getProtectedResourceMetadataUrl(metadataConfig)}`);
      }
    })
    .catch((err: unknown) => {
      console.error('Failed to start MCP HTTP server:', err);
      process.exit(1);
    });
}

function handleCorsPreflight(
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
): Promise<void> {
  const path = (req.url ?? '').split('?')[0];

  if (handleCorsPreflight(req, res, config)) {
    return;
  }

  if (path === '/health/live' || path === '/health/ready') {
    handleHealth(path, res, config);
    return;
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && handleMetadata(path, res, config)) {
    return;
  }

  if (path !== config.mcpPath) {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const sid = getSessionId(req);

  if (req.method === 'POST') {
    await handleMcpPost(req, res, config, sessionStore, sid);
    return;
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    await handleMcpGetOrDelete(req, res, config, sessionStore, sid);
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST, DELETE' }).end();
}
