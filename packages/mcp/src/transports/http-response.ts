import { timingSafeEqual } from 'node:crypto';

import type { ServerResponse } from 'node:http';

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
  dangerouslyAllowAnyOrigin = false,
): boolean {
  if (!origin || typeof origin !== 'string') return true;
  if (allowedOrigins.length > 0) return allowedOrigins.includes(origin);
  return dangerouslyAllowAnyOrigin;
}

export function buildCorsHeaders(
  origin: string | undefined,
  allowedOrigins: string[],
  dangerouslyAllowAnyOrigin = false,
): Record<string, string> {
  if (!origin) return {};
  if (allowedOrigins.length > 0) {
    if (!allowedOrigins.includes(origin)) return {};
  } else if (!dangerouslyAllowAnyOrigin) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-API-Key',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
    Vary: 'Origin',
  };
}

export function applyResponseHeaders(res: ServerResponse, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  res
    .writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
    .end(JSON.stringify(body));
}
