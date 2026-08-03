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
  createOAuthBroker,
  isOAuthBrokerPath,
  type OAuthBroker,
} from '../auth/oauth-broker/routes.js';
import { createOAuthBearerProvider } from '../auth/providers/bearer-context-provider.js';
import { EnvContextProvider } from '../auth/providers/env-context-provider.js';
import { assertHttpSignedStateKeyConfigured } from '../auth/request-state-key.js';
import {
  authenticateLightdashOAuth,
  writeOAuthAuthFailure,
} from '../auth/resource-server/lightdash-oauth-middleware.js';
import {
  buildOAuthProtectedResourceMetadata,
  getProtectedResourceMetadataUrl,
  resolveProtectedResourceMcpPath,
} from '../auth/resource-server/oauth-protected-resource.js';
import { authenticateSharedKey } from '../auth/resource-server/shared-key-middleware.js';
import { hashToken } from '../auth/token-hash.js';
import {
  getOAuthCallbackUrl,
  loadMcpHttpConfig,
  requiresLightdashApiKey,
  emitMcpHttpSecurityWarnings,
  type McpHttpConfig,
} from '../config/load-mcp-config.js';
import { getClient, getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from '../config/runtime.js';
import { validateAvailableProjectsConfig } from '../governance/available-projects.js';
import { prepareServerClientCapabilities } from '../governance/client-capabilities-cache.js';
import {
  extractPinnedProjectFromRequest,
  runWithProjectPinAsync,
} from '../governance/project-pin.js';
import { getPersonaByPath, listPersonaPaths } from '../personas/index.js';
import { createLightdashMcpServer } from '../server/server.js';

import { parseJsonBody, readBody, drainRequestBody } from './http-body.js';
import { applyResponseHeaders, buildCorsHeaders, checkOrigin, sendJson } from './http-response.js';

import type { PersonaDefinition } from '../personas/types.js';
import type { McpContextProvider } from '../server/request-context.js';

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

function createEnvContextProvider(config: McpHttpConfig): McpContextProvider {
  return new EnvContextProvider({
    mode:
      config.authMode === MCP_AUTH_MODE_SHARED_KEY ? MCP_AUTH_MODE_SHARED_KEY : MCP_AUTH_MODE_NONE,
    client: getClient(),
  });
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

/**
 * Auth helpers for persona MCP routes. PRM path resolution lives in
 * `oauth-protected-resource.ts` (single owner for well-known PRM grammar).
 */

async function ensureEndpointAuth(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  mcpPath: string,
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

  const result = await authenticateLightdashOAuth(req, config, mcpPath);
  if (!result.ok) {
    writeOAuthAuthFailure(res, result);
    return false;
  }

  (req as OAuthRequest).lightdashOAuth = result;
  return true;
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

/**
 * Creates a fresh context provider for the current request.
 * For OAuth, uses the bearer token from this request directly.
 * For shared-key/none, uses the env-based provider.
 */
function createContextProviderForRequest(
  config: McpHttpConfig,
  req: IncomingMessage,
): McpContextProvider {
  if (config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH) {
    const oauth = (req as OAuthRequest).lightdashOAuth;
    if (oauth?.ok) {
      return createOAuthBearerProvider(config, {
        accessToken: oauth.accessToken,
        subject: oauth.user.userUuid,
      });
    }
    throw new Error('OAuth auth mode requires authenticated request context');
  }
  return createEnvContextProvider(config);
}

interface McpRequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  config: McpHttpConfig;
  persona: PersonaDefinition;
}

/**
 * Handles a MCP POST by creating a fresh stateless transport + server per request.
 * No session affinity — each POST is independent (ADR-0019).
 */
async function handleMcpPost(ctx: McpRequestContext): Promise<void> {
  const { req, res, config, persona } = ctx;

  if (!(await ensureEndpointAuth(req, res, config, persona.path))) {
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

  const contextProvider = createContextProviderForRequest(config, req);
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createLightdashMcpServer(contextProvider, { persona });
  const auditAuth = getOAuthAuditContext(req);
  prepareServerClientCapabilities(server, body, auditAuth, persona.path);

  try {
    await server.connect(transport);
    await runWithToolAuditAuthAsync(auditAuth, () => transport.handleRequest(req, res, body));
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
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

  warnIgnoredCliGuardrailEnvVars();
  validateAvailableProjectsConfig();
  assertHttpSignedStateKeyConfigured();
  initAuditLog(getAuditLogPath());

  let httpConfig = inputConfig;

  let oauthBroker: OAuthBroker | undefined;

  const server = createServer((req, res) => {
    handleHttpRequest(req, res, httpConfig, oauthBroker).catch((err) => {
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

function requestOrigin(req: IncomingMessage): string | undefined {
  return typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
}

/**
 * Applies CORS reflect headers without blocking.
 * When `reflectAnyOrigin` is true (OAuth AS / PRM), always echo Origin and ignore
 * `ALLOWED_ORIGINS` so Cursor loopback (`http://localhost:8787`) can read token JSON
 * even if persona MCP routes use a browser allowlist.
 */
function applyOptionalCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  reflectAnyOrigin = false,
): void {
  const allowed = reflectAnyOrigin ? [] : config.allowedOrigins;
  applyResponseHeaders(res, buildCorsHeaders(requestOrigin(req), allowed, reflectAnyOrigin));
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
  const origin = requestOrigin(req);
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

/**
 * Health, OAuth broker, and PRM discovery — no Origin allowlist gate.
 * Returns true when the request was fully handled.
 */
async function handlePublicHttpPaths(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  path: string,
  oauthBroker: OAuthBroker | undefined,
): Promise<boolean> {
  if (path === '/health/live' || path === '/health/ready') {
    applyOptionalCorsHeaders(req, res, config);
    handleHealth(path, res, config);
    return true;
  }

  if (oauthBroker !== undefined && isOAuthBrokerPath(path)) {
    applyOptionalCorsHeaders(req, res, config, true);
    return oauthBroker.handle(req, res, path);
  }

  const prmMcpPath =
    config.authMode === MCP_AUTH_MODE_LIGHTDASH_OAUTH
      ? resolveProtectedResourceMcpPath(path, config)
      : undefined;
  if (prmMcpPath !== undefined) {
    applyOptionalCorsHeaders(req, res, config, true);
    sendJson(res, 200, buildOAuthProtectedResourceMetadata(config, prmMcpPath));
    return true;
  }

  return false;
}

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpConfig,
  oauthBroker: OAuthBroker | undefined,
): Promise<void> {
  const path = (req.url ?? '').split('?')[0] ?? '';

  if (await handlePublicHttpPaths(req, res, config, path, oauthBroker)) {
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

  // Sessionless: only POST is supported on persona MCP paths.
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  const pinnedProjectUuid = extractPinnedProjectFromRequest(req);

  await runWithProjectPinAsync(pinnedProjectUuid, () =>
    handleMcpPost({ req, res, config, persona }),
  );
}
