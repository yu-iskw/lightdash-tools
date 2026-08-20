import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';

import { SecretString } from '@lightdash-tools/client';

import { mintMcpAccessToken } from './auth/oauth-broker/mcp-access-token.js';
import { makeTestMcpHttpConfig } from './config/test-mcp-http-config.js';
import type { McpHttpConfig } from './config/load-mcp-config.js';
import type { AddressInfo } from 'node:net';

// These constants model downstream Lightdash credentials only. MCP clients never send
// them directly after ADR-0026; tests wrap them in broker-issued MCP access tokens.
export const TOKEN_A = scopedAccessToken('mcp:read mcp:write', 'token-a');
export const TOKEN_B = scopedAccessToken('mcp:read mcp:write', 'token-b');
export const TOKEN_READ_ONLY = scopedAccessToken('mcp:read', 'token-read-only');
export const OPAQUE_TOKEN_A = 'opaque-token-user-a';

const USER_A = { userUuid: 'user-a-uuid', email: 'a@example.com', organizationUuid: 'org-a-uuid' };
const USER_B = { userUuid: 'user-b-uuid', email: 'b@example.com', organizationUuid: 'org-b-uuid' };

function scopedAccessToken(scope: string, subject: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ scope, sub: subject })).toString('base64url');
  return `${header}.${payload}.signature`;
}

export const INITIALIZE_BODY = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'integration-test', version: '1.0.0' },
  },
  id: 1,
};

export interface MockLightdashServer {
  baseUrl: string;
  authorizationHeaders: string[];
  close: () => Promise<void>;
}

export interface McpHttpServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

export async function startMockLightdashServer(): Promise<MockLightdashServer> {
  const authorizationHeaders: string[] = [];
  const users: Record<string, { userUuid: string; email: string; organizationUuid?: string }> = {
    [TOKEN_A]: USER_A,
    [TOKEN_B]: USER_B,
    [TOKEN_READ_ONLY]: USER_A,
    [OPAQUE_TOKEN_A]: USER_A,
  };

  let issuerBaseUrl = '';

  const server = createServer((req, res) => {
    const authHeader = req.headers.authorization;
    const auth = typeof authHeader === 'string' ? authHeader : (authHeader?.[0] ?? '');
    authorizationHeaders.push(auth);

    if (req.method === 'GET' && req.url === '/.well-known/oauth-authorization-server') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          issuer: issuerBaseUrl,
          authorization_endpoint: `${issuerBaseUrl}/api/v1/oauth/authorize`,
          token_endpoint: `${issuerBaseUrl}/api/v1/oauth/token`,
          revocation_endpoint: `${issuerBaseUrl}/api/v1/oauth/revoke`,
          registration_endpoint: `${issuerBaseUrl}/api/v1/oauth/register`,
          userinfo_endpoint: `${issuerBaseUrl}/api/v1/oauth/userinfo`,
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/api/v1/user') {
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
      const user = users[token];
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'error',
            error: { statusCode: 401, name: 'Unauthorized', message: 'Invalid token' },
          }),
        );
        return;
      }

      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ok', results: user }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/v1/org/projects') {
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
      if (!users[token]) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'error',
            error: { statusCode: 401, name: 'Unauthorized', message: 'Invalid token' },
          }),
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'ok',
          results: [
            {
              projectUuid: 'project-a-uuid',
              name: 'Project A',
              type: 'DEFAULT',
            },
          ],
        }),
      );
      return;
    }

    res.writeHead(404).end();
  });

  await listen(server, 0, '127.0.0.1');
  const address = server.address() as AddressInfo;
  issuerBaseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl: issuerBaseUrl,
    authorizationHeaders,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

export function baseOAuthConfig(
  lightdashUrl: string,
  overrides?: Partial<McpHttpConfig>,
): McpHttpConfig {
  return makeTestMcpHttpConfig({
    lightdashUrl,
    port: 0,
    publicUrl: 'http://127.0.0.1:0',
    oauthClientId: 'test-client-id',
    oauthClientSecret: new SecretString('test-client-secret'),
    maxBodyBytes: 1024 * 1024,
    requiredScopes: [],
    scopesSupported: [],
    ...overrides,
  });
}

export function brokerAccessToken(
  mcpBaseUrl: string,
  lightdashAccessToken: string,
  options: { path?: string; scope?: string } = {},
): string {
  const path = options.path ?? '/semantic-layer/v1/mcp';
  return mintMcpAccessToken(baseOAuthConfig('https://lightdash.invalid'), {
    lightdashAccessToken,
    clientId: 'integration-test-client',
    resource: `${mcpBaseUrl}${path}`,
    scope: options.scope,
    expiresAtMs: Date.now() + 60_000,
  }).accessToken;
}

export function nodeRequest(options: {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  status: number;
  headers: IncomingHttpHeaders;
  json: unknown;
}> {
  const url = new URL(options.path, options.baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown = text;
          try {
            json = JSON.parse(text);
          } catch {
            // keep text
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            json,
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

export async function postMcp(
  baseUrl: string,
  body: unknown,
  options?: { token?: string; path?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const path = options?.path ?? '/semantic-layer/v1/mcp';
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
