import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { initAuditLog } from '../audit.js';
import {
  MCP_AUTH_MODE_LIGHTDASH_OAUTH,
  MCP_AUTH_MODE_NONE,
  MCP_AUTH_MODE_SHARED_KEY,
} from '../auth/auth-mode.js';
import { BearerContextProvider } from '../auth/bearer-context-provider.js';
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
import { authenticateSharedKey, checkOrigin, sendJson } from '../auth/shared-key-middleware.js';
import {
  loadMcpHttpConfig,
  requiresLightdashApiKey,
  type McpHttpConfig,
} from '../config/load-mcp-config.js';
import { getAuditLogPath, getClient } from '../config.js';
import { createLightdashMcpServer } from '../server.js';

import { isInitializeMessage } from './http-request-utils.js';
import { SessionStore, type SessionEntry } from './session-store.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const ERROR_UNAUTHORIZED = 'Unauthorized';
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

function readBody(
  req: IncomingMessage,
  res: ServerResponse,
  maxBodyBytes: number,
): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBodyBytes) {
        rejected = true;
        req.destroy();
        sendJson(res, 413, { error: 'Payload Too Large' });
        resolve(undefined);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function parseJsonBody(buffer: Buffer): unknown {
  const text = buffer.toString('utf-8');
  if (!text.trim()) return undefined;
  return JSON.parse(text) as unknown;
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

  const metadata = buildOAuthProtectedResourceMetadata(config);
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(metadata));
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
    sendJson(res, 401, { error: ERROR_UNAUTHORIZED });
    return false;
  }

  const provider = new BearerContextProvider({
    baseUrl: config.lightdashUrl,
    accessToken: oauth.accessToken,
    proxyAuthorization: config.proxyAuthorization,
  });

  if (entry.auth.tokenHash && entry.auth.tokenHash !== provider.getTokenHash()) {
    sendJson(res, 401, { error: 'Session token mismatch' });
    return false;
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
  if (!(await ensureEndpointAuth(req, res, config))) return;
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
  if (!sessionStore.canAcceptNewSession()) {
    sendJson(res, 503, { error: 'Service Unavailable: max sessions reached' });
    return;
  }

  if (!(await ensureEndpointAuth(req, res, config))) return;

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    const oauth = (req as OAuthRequest).lightdashOAuth;
    if (!oauth?.ok) {
      sendJson(res, 401, { error: ERROR_UNAUTHORIZED });
      return;
    }

    const contextProvider = new BearerContextProvider({
      baseUrl: config.lightdashUrl,
      accessToken: oauth.accessToken,
      proxyAuthorization: config.proxyAuthorization,
      subject: oauth.user.userUuid,
    });

    const transport = createSessionTransport(contextProvider, sessionStore, {
      mode: MCP_AUTH_MODE_LIGHTDASH_OAUTH,
      tokenHash: contextProvider.getTokenHash(),
      subject: oauth.user.userUuid,
    });
    await transport.handleRequest(req, res, body);
    return;
  }

  const transport = createSessionTransport(createEnvContextProvider(config), sessionStore, {
    mode: config.authMode,
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
  const raw = await readBody(req, res, config.maxBodyBytes);
  if (raw === undefined) return;

  const body = raw.length > 0 ? parseJsonBody(raw) : undefined;

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

  const entry = sessionStore.get(sid);
  if (!entry) {
    sendJson(res, 404, { error: ERROR_SESSION_NOT_FOUND });
    return;
  }

  if (!(await ensureEndpointAuth(req, res, config))) return;
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

  if (inputConfig.authMode === MCP_AUTH_MODE_NONE) {
    console.warn(
      'Warning: LIGHTDASH_TOOLS_MCP_AUTH_MODE=none — MCP HTTP endpoint is unauthenticated. Use lightdash-oauth or shared-key in production.',
    );
  }

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

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  sessionStore: SessionStore,
): Promise<void> {
  const path = (req.url ?? '').split('?')[0];

  if (path === '/health/live' || path === '/health/ready') {
    handleHealth(path, res, config);
    return;
  }

  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH && handleMetadata(path, res, config)) {
    return;
  }

  const origin = req.headers.origin;
  if (!checkOrigin(typeof origin === 'string' ? origin : undefined, config.allowedOrigins)) {
    sendJson(res, 403, { error: 'Forbidden: origin not allowed' });
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
