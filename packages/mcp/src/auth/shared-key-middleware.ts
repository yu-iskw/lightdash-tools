import { timingSafeEqual } from 'node:crypto';

import type { McpHttpConfig } from '../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin || typeof origin !== 'string') return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

export interface SharedKeyAuthSuccess {
  ok: true;
}

export interface SharedKeyAuthFailure {
  ok: false;
  status: number;
  body: Record<string, string>;
}

export type SharedKeyAuthResult = SharedKeyAuthFailure | SharedKeyAuthSuccess;

/** Validates MCP endpoint shared key from Bearer or X-API-Key header. */
export function authenticateSharedKey(
  req: IncomingMessage,
  config: McpHttpConfig,
): SharedKeyAuthResult {
  const expected = config.sharedKey?.expose();
  if (!expected) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Server auth misconfiguration: shared key is missing' },
    };
  }

  const bearer = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  const token =
    typeof bearer === 'string' && bearer.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : undefined;
  const key = typeof apiKey === 'string' ? apiKey.trim() : undefined;
  const provided = token ?? key;

  if (!provided || !timingSafeEqualString(provided, expected)) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }

  return { ok: true };
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, string>,
  extraHeaders?: Record<string, string>,
): void {
  res
    .writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
    .end(JSON.stringify(body));
}
