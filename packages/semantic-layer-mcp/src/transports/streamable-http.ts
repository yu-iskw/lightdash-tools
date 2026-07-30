/**
 * Streamable HTTP transport — lightdash-oauth only (ADR-0040 / ADR-0041).
 */

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

import { MCP_AUTH_MODE_LIGHTDASH_OAUTH } from '../auth/auth-mode.js';
import {
  BearerContextProvider,
  createOAuthBearerProvider,
} from '../auth/bearer-context-provider.js';
import {
  authenticateLightdashOAuth,
  writeOAuthAuthFailure,
} from '../auth/lightdash-oauth-middleware.js';
import {
  buildOAuthProtectedResourceMetadata,
  getProtectedResourceMetadataPathUrl,
  getProtectedResourceMetadataUrl,
} from '../auth/oauth-protected-resource.js';
import { hashToken } from '../auth/token-hash.js';
import { buildWwwAuthenticateHeader } from '../auth/www-authenticate.js';
import {
  emitMcpHttpSecurityWarnings,
  loadMcpHttpConfig,
  type McpHttpConfig,
} from '../config/load-http-config.js';
import { extractPinnedProjectFromRequest, runWithProjectPinAsync } from '../project-pin.js';
import { createSemanticLayerMcpServer } from '../server.js';

import { parseJsonBody, readBody, drainRequestBody } from './http-body.js';
import { isInitializeMessage } from './http-request-utils.js';
import { applyResponseHeaders, buildCorsHeaders, checkOrigin, sendJson } from './http-response.js';
import { SessionStore, type SessionEntry } from './session-store.js';

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

function closeSessionEntry(entry: SessionEntry, sessionId: string, reason: string): void {
  void Promise.all([entry.transport.close(), entry.server.close()]).catch((err: unknown) => {
    console.error(`Failed to close MCP session ${sessionId} (${reason}):`, err);
  });
}

function createSessionTransport(
  contextProvider: McpContextProvider,
  sessionStore: SessionStore,
  auth: {
    tokenHash?: string;
    subject?: string;
    organizationUuid?: string;
  },
): NodeStreamableHTTPServerTransport {
  const holder: { server: McpServer } = {
    server: createSemanticLayerMcpServer(contextProvider),
  };
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessionStore.set(sessionId, {
        transport,
        server: holder.server,
        lastAccessAt: Date.now(),
        auth: {
          mode: MCP_AUTH_MODE_LIGHTDASH_OAUTH,
          tokenHash: auth.tokenHash,
          subject: auth.subject,
          organizationUuid: auth.organizationUuid,
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

function handleHealth(path: string, res: ServerResponse): void {
  if (path === '/health/live') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }
  sendJson(res, 200, { status: 'ready' });
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
      error: 'invalid_token',
      errorDescription,
    }),
  });
}

function verifySessionAuth(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  entry: SessionEntry | undefined,
): boolean {
  if (!entry) return true;

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

async function handleExistingSessionPost(
  ctx: {
    req: IncomingMessage;
    res: ServerResponse;
    config: McpHttpConfig;
    sessionStore: SessionStore;
  },
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
  await entry.transport.handleRequest(req, res, body);
}

async function handleInitializePost(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  body: unknown,
): Promise<void> {
  const oauth = (req as OAuthRequest).lightdashOAuth;
  const sessionSubject = oauth?.ok ? oauth.user.userUuid : undefined;

  if (
    !sessionStore.canAcceptNewSession(sessionSubject, (entry, sessionId) => {
      closeSessionEntry(entry, sessionId, 'expired');
    })
  ) {
    sendJson(res, 503, { error: 'Service Unavailable: max sessions reached' });
    return;
  }

  if (!oauth?.ok) {
    writeBearerTokenRequiredFailure(res, config);
    return;
  }

  const contextProvider = createOAuthBearerProvider(config, {
    accessToken: oauth.accessToken,
    subject: oauth.user.userUuid,
  });

  const transport = createSessionTransport(contextProvider, sessionStore, {
    tokenHash: contextProvider.getTokenHash(),
    subject: oauth.user.userUuid,
    organizationUuid: oauth.user.organizationUuid,
  });
  await transport.handleRequest(req, res, body);
}

async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
  sid: string | undefined,
): Promise<void> {
  if (!(await ensureEndpointAuth(req, res, config))) {
    drainRequestBody(req);
    return;
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

  if (!(await ensureEndpointAuth(req, res, config))) return;

  const entry = sessionStore.get(sid);
  if (!entry) {
    sendJson(res, 404, { error: ERROR_SESSION_NOT_FOUND });
    return;
  }

  if (!verifySessionAuth(req, res, config, entry)) return;

  sessionStore.touch(sid);
  await entry.transport.handleRequest(req, res);
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
        `Lightdash semantic-layer MCP listening on ${baseUrl}${httpConfig.mcpPath} (auth: lightdash-oauth)`,
      );
      const metadataConfig = httpConfig.publicUrl
        ? httpConfig
        : { ...httpConfig, publicUrl: baseUrl };
      console.error(`OAuth metadata: ${getProtectedResourceMetadataUrl(metadataConfig)}`);
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
  if (!checkOrigin(origin, config.allowedOrigins, config.dangerouslyAllowAnyOrigin)) {
    sendJson(res, 403, { error: 'Forbidden: origin not allowed' });
    return true;
  }

  const corsHeaders = buildCorsHeaders(
    origin,
    config.allowedOrigins,
    config.dangerouslyAllowAnyOrigin,
  );
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
    handleHealth(path, res);
    return;
  }

  if (handleMetadata(path, res, config)) {
    return;
  }

  if (path !== config.mcpPath) {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const sid = getSessionId(req);
  const pinnedProjectUuid = extractPinnedProjectFromRequest(req);

  await runWithProjectPinAsync(pinnedProjectUuid, async () => {
    if (req.method === 'POST') {
      await handleMcpPost(req, res, config, sessionStore, sid);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      await handleMcpGetOrDelete(req, res, config, sessionStore, sid);
      return;
    }

    res.writeHead(405, { Allow: 'GET, POST, DELETE' }).end();
  });
}
