/**
 * MCP server entrypoint (Streamable HTTP). Use LIGHTDASH_URL, LIGHTDASH_API_KEY.
 * Optional: MCP_AUTH_ENABLED, MCP_API_KEY, MCP_ALLOWED_ORIGINS. Logging: stderr only.
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { initAuditLog } from './audit.js';
import { getClient, getAuditLogPath } from './config.js';
import { createLightdashMcpServer } from './server.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const MCP_PATH = '/mcp';
const PORT = Number(process.env.MCP_HTTP_PORT ?? '3100');
const MAX_BODY_BYTES = Number(process.env.MCP_MAX_BODY_BYTES ?? 1024 * 1024);
const SESSION_TTL_MS = Number(process.env.MCP_SESSION_TTL_MS ?? 30 * 60 * 1000);
const MAX_SESSIONS = Number(process.env.MCP_MAX_SESSIONS ?? 100);
const SESSION_CLEANUP_INTERVAL_MS = Number(process.env.MCP_SESSION_CLEANUP_MS ?? 60_000);

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastAccessAt: number;
}

const sessionMap = new Map<string, SessionEntry>();
const sharedClient = getClient();

function isAuthEnabled(): boolean {
  const v = process.env.MCP_AUTH_ENABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

function getExpectedApiKey(): string | undefined {
  return process.env.MCP_API_KEY;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function getAllowedOrigins(): Set<string> {
  const raw = process.env.MCP_ALLOWED_ORIGINS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function originMiddleware(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin || typeof origin !== 'string') return true;

  const allowed = getAllowedOrigins();
  if (allowed.size === 0) return true;

  if (!allowed.has(origin)) {
    sendJson(res, 403, { error: 'Forbidden: origin not allowed' });
    return false;
  }
  return true;
}

function authMiddleware(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isAuthEnabled()) return true;
  const expected = getExpectedApiKey();
  if (!expected) {
    console.error('MCP_AUTH_ENABLED is set but MCP_API_KEY is missing');
    sendJson(res, 500, { error: 'Server auth misconfiguration' });
    return false;
  }
  const bearer = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  const token =
    typeof bearer === 'string' && bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : undefined;
  const key = typeof apiKey === 'string' ? apiKey.trim() : undefined;
  const provided = token ?? key;
  if (!provided || !timingSafeEqualString(provided, expected)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, entry] of sessionMap) {
    if (now - entry.lastAccessAt > SESSION_TTL_MS) {
      sessionMap.delete(sessionId);
      void Promise.all([entry.transport.close(), entry.server.close()]).catch((err: unknown) => {
        console.error(`Failed to close expired MCP session ${sessionId}:`, err);
      });
    }
  }
}

function touchSession(sessionId: string): void {
  const entry = sessionMap.get(sessionId);
  if (entry) {
    entry.lastAccessAt = Date.now();
  }
}

function canAcceptNewSession(res: ServerResponse): boolean {
  cleanupExpiredSessions();
  if (sessionMap.size >= MAX_SESSIONS) {
    sendJson(res, 503, { error: 'Service Unavailable: max sessions reached' });
    return false;
  }
  return true;
}

function createSessionTransport(): StreamableHTTPServerTransport {
  const server = createLightdashMcpServer(sharedClient);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessionMap.set(sessionId, { transport, server, lastAccessAt: Date.now() });
    },
    onsessionclosed: (sessionId) => {
      const entry = sessionMap.get(sessionId);
      sessionMap.delete(sessionId);
      if (entry) {
        void Promise.all([entry.transport.close(), entry.server.close()]).catch((err: unknown) => {
          console.error(`Failed to close MCP session ${sessionId}:`, err);
        });
      }
    },
  });

  server.connect(transport).catch((err) => {
    console.error('MCP server connect error:', err);
  });

  return transport;
}

function readBody(req: IncomingMessage, res: ServerResponse): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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

function isInitializeMessage(body: unknown): boolean {
  if (body === undefined) return false;
  const msg = Array.isArray(body) ? body[0] : body;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'method' in msg &&
    (msg as { method?: string }).method === 'initialize'
  );
}

function getSessionId(req: IncomingMessage): string | undefined {
  const sessionId = req.headers['mcp-session-id'];
  return typeof sessionId === 'string' ? sessionId : sessionId?.[0];
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, string>,
  extraHeaders?: Record<string, string>,
): void {
  res
    .writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
    .end(JSON.stringify(body));
}

function getSessionTransport(
  res: ServerResponse,
  sid: string | undefined,
): StreamableHTTPServerTransport | undefined {
  if (!sid) {
    sendJson(res, 400, { error: 'Bad Request: Mcp-Session-Id required' });
    return undefined;
  }
  const entry = sessionMap.get(sid);
  if (!entry) {
    sendJson(res, 404, { error: 'Session not found' });
    return undefined;
  }
  touchSession(sid);
  return entry.transport;
}

function handleHealth(path: string, res: ServerResponse): void {
  if (path === '/health/live') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  try {
    getClient();
    sendJson(res, 200, { status: 'ready' });
  } catch {
    sendJson(res, 503, { status: 'not ready' });
  }
}

async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  sid: string | undefined,
): Promise<void> {
  const raw = await readBody(req, res);
  if (raw === undefined) return;

  const body = raw.length > 0 ? parseJsonBody(raw) : undefined;

  if (sid) {
    const transport = getSessionTransport(res, sid);
    if (!transport) return;
    await transport.handleRequest(req, res, body);
    return;
  }

  if (body !== undefined && isInitializeMessage(body)) {
    if (!canAcceptNewSession(res)) return;
    const transport = createSessionTransport();
    await transport.handleRequest(req, res, body);
    return;
  }

  sendJson(res, 400, {
    error: 'Bad Request: Mcp-Session-Id required for non-initialize requests',
  });
}

async function handleMcpGetOrDelete(
  req: IncomingMessage,
  res: ServerResponse,
  sid: string | undefined,
): Promise<void> {
  const transport = getSessionTransport(res, sid);
  if (!transport) return;
  await transport.handleRequest(req, res);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? '').split('?')[0];

  if (path === '/health/live' || path === '/health/ready') {
    handleHealth(path, res);
    return;
  }

  if (!originMiddleware(req, res)) return;
  if (!authMiddleware(req, res)) return;

  if (path !== MCP_PATH) {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const sid = getSessionId(req);

  if (req.method === 'POST') {
    await handleMcpPost(req, res, sid);
    return;
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    await handleMcpGetOrDelete(req, res, sid);
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST, DELETE' }).end();
}

function main(): void {
  initAuditLog(getAuditLogPath());

  const cleanupTimer = setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('MCP HTTP handler error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal Server Error' });
      }
    });
  });

  server.listen(PORT, () => {
    console.error(`Lightdash MCP server listening on http://localhost:${PORT}${MCP_PATH}`);
  });
}

main();
