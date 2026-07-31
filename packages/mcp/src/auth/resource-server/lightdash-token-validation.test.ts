import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { makeTestMcpHttpConfig } from '../../config/test-mcp-http-config.js';

import { validateLightdashAccessToken } from './lightdash-token-validation.js';

import type { AddressInfo } from 'node:net';

function baseConfig(lightdashUrl: string, overrides?: Parameters<typeof makeTestMcpHttpConfig>[0]) {
  return makeTestMcpHttpConfig({ lightdashUrl, ...overrides });
}

async function startUserApiServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

describe('validateLightdashAccessToken', () => {
  it('skips upstream validation when validateToken is false', async () => {
    const user = await validateLightdashAccessToken(
      baseConfig('http://127.0.0.1:1', { validateToken: false }),
      'dev-token',
    );

    expect(user.email).toBe('unvalidated@localhost');
    expect(user.userUuid).toMatch(/^unvalidated:/);
  });

  it('validates Lightdash OAuth bearer via Authorization Bearer on GET /api/v1/user', async () => {
    const seenHeaders: string[] = [];
    const api = await startUserApiServer((req, res) => {
      const auth = req.headers.authorization ?? '';
      seenHeaders.push(typeof auth === 'string' ? auth : (auth[0] ?? ''));
      if (req.method === 'GET' && req.url === '/api/v1/user') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'ok',
            results: { userUuid: 'u1', email: 'a@b.com', organizationUuid: 'org-1' },
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });

    try {
      const user = await validateLightdashAccessToken(
        baseConfig(api.baseUrl),
        'oauth-access-token',
      );
      expect(user.userUuid).toBe('u1');
      expect(seenHeaders).toContain('Bearer oauth-access-token');
    } finally {
      await api.close();
    }
  });

  it('returns validated user including organizationUuid when upstream provides it', async () => {
    const api = await startUserApiServer((req, res) => {
      if (req.method === 'GET' && req.url === '/api/v1/user') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'ok',
            results: { userUuid: 'u1', email: 'a@b.com', organizationUuid: 'org-1' },
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });

    try {
      const user = await validateLightdashAccessToken(baseConfig(api.baseUrl), 'good-token');
      expect(user).toEqual({
        userUuid: 'u1',
        email: 'a@b.com',
        organizationUuid: 'org-1',
      });
    } finally {
      await api.close();
    }
  });

  it('returns validated user without organizationUuid when upstream omits it', async () => {
    const api = await startUserApiServer((req, res) => {
      if (req.method === 'GET' && req.url === '/api/v1/user') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            status: 'ok',
            results: { userUuid: 'u1', email: 'a@b.com' },
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });

    try {
      const user = await validateLightdashAccessToken(baseConfig(api.baseUrl), 'good-token');
      expect(user.organizationUuid).toBeUndefined();
    } finally {
      await api.close();
    }
  });

  it('throws invalid_token for upstream 403 and logs sanitized status', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = await startUserApiServer((_req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'error',
          error: { statusCode: 403, name: 'Forbidden', message: 'Forbidden' },
        }),
      );
    });

    try {
      await expect(
        validateLightdashAccessToken(baseConfig(api.baseUrl), 'forbidden-token'),
      ).rejects.toMatchObject({
        reason: 'invalid_token',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        'Lightdash token validation rejected bearer token (upstream HTTP 403)',
      );
    } finally {
      await api.close();
      warnSpy.mockRestore();
    }
  });

  it('throws invalid_token for upstream 401', async () => {
    const api = await startUserApiServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'error',
          error: { statusCode: 401, name: 'Unauthorized', message: 'Invalid token' },
        }),
      );
    });

    try {
      await expect(
        validateLightdashAccessToken(baseConfig(api.baseUrl), 'bad-token'),
      ).rejects.toMatchObject({
        reason: 'invalid_token',
      });
    } finally {
      await api.close();
    }
  });

  it('throws upstream_unavailable for upstream 503', async () => {
    const api = await startUserApiServer((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'error',
          error: { statusCode: 503, name: 'ServiceUnavailable', message: 'Down' },
        }),
      );
    });

    try {
      await expect(
        validateLightdashAccessToken(baseConfig(api.baseUrl), 'any-token'),
      ).rejects.toMatchObject({
        reason: 'upstream_unavailable',
      });
    } finally {
      await api.close();
    }
  });

  it('throws upstream_unavailable for upstream 429 rate limits', async () => {
    const api = await startUserApiServer((_req, res) => {
      res
        .writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': '30',
        })
        .end(
          JSON.stringify({
            status: 'error',
            error: { statusCode: 429, name: 'TooManyRequests', message: 'Slow down' },
          }),
        );
    });

    try {
      await expect(
        validateLightdashAccessToken(baseConfig(api.baseUrl), 'any-token'),
      ).rejects.toMatchObject({
        reason: 'upstream_unavailable',
        retryAfterSeconds: 30,
      });
    } finally {
      await api.close();
    }
  });
});
