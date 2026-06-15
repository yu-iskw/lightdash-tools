/**
 * Unit tests for MCP HTTP transport middleware helpers.
 */

import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { checkOrigin, timingSafeEqualString } from './auth/shared-key-middleware.js';
import { isInitializeMessage } from './transports/http-request-utils.js';

import type { IncomingMessage } from 'node:http';

type MockResponse = {
  statusCode?: number;
  body?: string;
  headers: Record<string, string>;
  writeHead: (status: number, headers?: Record<string, string>) => MockResponse;
  end: (chunk?: string) => MockResponse;
};

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      if (headers) this.headers = { ...this.headers, ...headers };
      return this;
    },
    end(chunk) {
      this.body = chunk;
      return this;
    },
  };
  return res;
}

function readBodyWithLimit(
  req: IncomingMessage,
  res: MockResponse,
  maxBytes: number,
): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        if (typeof req.destroy === 'function') {
          req.destroy();
        }
        res
          .writeHead(413, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Payload Too Large' }));
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

describe('HTTP transport helpers', () => {
  describe('health endpoints', () => {
    it('live health returns ok status payload', () => {
      const res = createMockResponse();
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ok' }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body ?? '{}')).toEqual({ status: 'ok' });
    });

    it('ready health returns ready when client config is available', () => {
      const res = createMockResponse();
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ready' }));
      expect(JSON.parse(res.body ?? '{}')).toEqual({ status: 'ready' });
    });

    it('ready health returns not ready with 503 when client config is missing', () => {
      const res = createMockResponse();
      res
        .writeHead(503, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'not ready' }));
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.body ?? '{}')).toEqual({ status: 'not ready' });
    });
  });

  describe('origin validation', () => {
    it('allows requests without Origin header', () => {
      const allowed = ['https://app.example.com'];
      expect(checkOrigin(undefined, allowed)).toBe(true);
    });

    it('allows any origin when allowlist is empty', () => {
      expect(checkOrigin('https://evil.example.com', [])).toBe(true);
    });

    it('allows listed origins', () => {
      const allowed = ['https://app.example.com', 'https://admin.example.com'];
      expect(checkOrigin('https://app.example.com', allowed)).toBe(true);
      expect(checkOrigin('https://admin.example.com', allowed)).toBe(true);
    });

    it('rejects unlisted origins when allowlist is configured', () => {
      const allowed = ['https://app.example.com'];
      expect(checkOrigin('https://other.example.com', allowed)).toBe(false);
    });
  });

  describe('auth token comparison', () => {
    it('accepts equal API keys with timing-safe comparison', () => {
      expect(timingSafeEqualString('secret-key', 'secret-key')).toBe(true);
    });

    it('rejects mismatched API keys', () => {
      expect(timingSafeEqualString('secret-key', 'wrong-key')).toBe(false);
    });
  });

  describe('body size rejection', () => {
    it('rejects payloads larger than MCP_MAX_BODY_BYTES', async () => {
      const req = new EventEmitter() as IncomingMessage;
      req.destroy = () => req.removeAllListeners() as unknown as IncomingMessage;
      const res = createMockResponse();
      const maxBytes = 16;

      const readPromise = readBodyWithLimit(req, res, maxBytes);
      req.emit('data', Buffer.from('a'.repeat(20)));
      req.emit('end');

      const body = await readPromise;
      expect(body).toBeUndefined();
      expect(res.statusCode).toBe(413);
      expect(JSON.parse(res.body ?? '{}')).toEqual({ error: 'Payload Too Large' });
    });

    it('accepts payloads within MCP_MAX_BODY_BYTES', async () => {
      const req = new EventEmitter() as IncomingMessage;
      const res = createMockResponse();
      const payload = Buffer.from('{"jsonrpc":"2.0"}');

      const readPromise = readBodyWithLimit(req, res, 1024);
      req.emit('data', payload);
      req.emit('end');

      const body = await readPromise;
      expect(body?.toString('utf-8')).toBe(payload.toString('utf-8'));
      expect(res.statusCode).toBe(200);
    });
  });

  describe('initialize detection', () => {
    it('detects initialize POST body', () => {
      expect(isInitializeMessage({ jsonrpc: '2.0', method: 'initialize', id: 1 })).toBe(true);
    });

    it('detects initialize in batch array', () => {
      expect(isInitializeMessage([{ jsonrpc: '2.0', method: 'initialize', id: 1 }])).toBe(true);
    });

    it('returns false for non-initialize methods', () => {
      expect(isInitializeMessage({ jsonrpc: '2.0', method: 'tools/list', id: 1 })).toBe(false);
    });
  });
});
