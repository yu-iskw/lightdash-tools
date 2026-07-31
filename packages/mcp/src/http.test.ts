/**
 * Unit tests for MCP HTTP transport helpers.
 */

import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { checkOrigin, timingSafeEqualString } from './auth/shared-key-middleware.js';
import { parseJsonBody, readBody } from './transports/http-body.js';
import { isInitializeMessage } from './transports/http-request-utils.js';
import { buildCorsHeaders, buildOAuthPublicCorsHeaders } from './transports/http-response.js';

import type { IncomingMessage, ServerResponse } from 'node:http';

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

describe('HTTP transport helpers', () => {
  describe('origin validation', () => {
    it('allows requests without Origin header', () => {
      const allowed = ['https://app.example.com'];
      expect(checkOrigin(undefined, allowed)).toBe(true);
    });

    it('rejects browser origins when allowlist is empty and dangerouslyAllowAnyOrigin is false', () => {
      expect(checkOrigin('https://evil.example.com', [], false)).toBe(false);
    });

    it('allows browser origins when dangerouslyAllowAnyOrigin is true', () => {
      expect(checkOrigin('https://browser.example.com', [], true)).toBe(true);
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

    it('builds CORS headers for allowed origins', () => {
      const allowed = ['https://app.example.com'];
      expect(buildCorsHeaders('https://app.example.com', allowed)).toEqual({
        'Access-Control-Allow-Origin': 'https://app.example.com',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-API-Key, X-Lightdash-Project',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
        Vary: 'Origin',
      });
      expect(buildCorsHeaders('https://other.example.com', allowed)).toEqual({});
      expect(buildCorsHeaders(undefined, allowed)).toEqual({});
    });

    it('omits CORS headers when allowlist is empty and dangerouslyAllowAnyOrigin is false', () => {
      expect(buildCorsHeaders('https://browser.example.com', [], false)).toEqual({});
    });

    it('echoes CORS headers when dangerouslyAllowAnyOrigin is true', () => {
      expect(buildCorsHeaders('https://browser.example.com', [], true)).toEqual({
        'Access-Control-Allow-Origin': 'https://browser.example.com',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-API-Key, X-Lightdash-Project',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
        Vary: 'Origin',
      });
    });

    it('reflects Origin on OAuth public routes even when MCP allowlist is empty', () => {
      expect(buildOAuthPublicCorsHeaders('http://localhost:8787')).toEqual({
        'Access-Control-Allow-Origin': 'http://localhost:8787',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-API-Key, X-Lightdash-Project',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
        Vary: 'Origin',
      });
      expect(buildOAuthPublicCorsHeaders(undefined)).toEqual({});
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

      const readPromise = readBody(req, res as unknown as ServerResponse, maxBytes);
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

      const readPromise = readBody(req, res as unknown as ServerResponse, 1024);
      req.emit('data', payload);
      req.emit('end');

      const body = await readPromise;
      expect(body?.toString('utf-8')).toBe(payload.toString('utf-8'));
      expect(res.statusCode).toBe(200);
    });
  });

  describe('JSON parsing', () => {
    it('throws on malformed JSON', () => {
      expect(() => parseJsonBody(Buffer.from('{not-json'))).toThrow(SyntaxError);
    });

    it('returns undefined for empty body', () => {
      expect(parseJsonBody(Buffer.from('   '))).toBeUndefined();
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
