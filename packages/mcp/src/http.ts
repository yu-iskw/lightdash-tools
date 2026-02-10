/**
 * MCP server entrypoint (Streamable HTTP). Use LIGHTDASH_URL, LIGHTDASH_API_KEY.
 * Optional: MCP_AUTH_ENABLED, MCP_API_KEY. Logging: stderr only.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getClient } from './config.js';
import { registerTools } from './tools/index.js';

const MCP_PATH = '/mcp';
const PORT = Number(process.env.MCP_HTTP_PORT ?? '3100');

const sessionMap = new Map<string, StreamableHTTPServerTransport>();
const sharedClient = getClient();

function isAuthEnabled(): boolean {
  const v = process.env.MCP_AUTH_ENABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

function getExpectedApiKey(): string | undefined {
  return process.env.MCP_API_KEY;
}

function authMiddleware(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isAuthEnabled()) return true;
  const expected = getExpectedApiKey();
  if (!expected) {
    console.error('MCP_AUTH_ENABLED is set but MCP_API_KEY is missing');
    res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Server auth misconfiguration' }));
    return false;
  }
  const bearer = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  const token =
    typeof bearer === 'string' && bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : undefined;
  const key = typeof apiKey === 'string' ? apiKey.trim() : undefined;
  const provided = token ?? key;
  if (!provided || provided !== expected) {
    res
      .writeHead(401, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

function createSessionTransport(): StreamableHTTPServerTransport {
  const server = new McpServer({ name: 'lightdash-mcp', version: '1.0.0' });
  registerTools(server, sharedClient);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessionMap.set(sessionId, transport);
    },
    onsessionclosed: (sessionId) => {
      sessionMap.delete(sessionId);
    },
  });

  server.connect(transport).catch((err) => {
    console.error('MCP server connect error:', err);
  });

  return transport;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
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

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!authMiddleware(req, res)) return;

  const url = req.url ?? '';
  const path = url.split('?')[0];
  if (path !== MCP_PATH) {
    res
      .writeHead(404, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  const sessionId = req.headers['mcp-session-id'];
  const sid =
    typeof sessionId === 'string' ? sessionId : Array.isArray(sessionId) ? sessionId[0] : undefined;

  if (req.method === 'POST') {
    const raw = await readBody(req);
    const body = raw.length > 0 ? parseJsonBody(raw) : undefined;

    if (sid) {
      const transport = sessionMap.get(sid);
      if (!transport) {
        res
          .writeHead(404, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      await transport.handleRequest(req, res, body);
      return;
    }

    if (body !== undefined && isInitializeMessage(body)) {
      const transport = createSessionTransport();
      await transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        error: 'Bad Request: Mcp-Session-Id required for non-initialize requests',
      }),
    );
    return;
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    if (!sid) {
      res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Bad Request: Mcp-Session-Id required' }));
      return;
    }
    const transport = sessionMap.get(sid);
    if (!transport) {
      res
        .writeHead(404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST, DELETE' }).end();
}

function main(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('MCP HTTP handler error:', err);
      if (!res.headersSent) {
        res
          .writeHead(500, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
  });

  server.listen(PORT, () => {
    console.error(`Lightdash MCP server listening on http://localhost:${PORT}${MCP_PATH}`);
  });
}

main();
