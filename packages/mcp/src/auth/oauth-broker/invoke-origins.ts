import { ENV_LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS } from '../../config/env.js';

import type { IncomingMessage } from 'node:http';

const INVOKE_ORIGIN_ABSOLUTE_ERROR = `${ENV_LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS} entries must be absolute http(s) origins`;

function parseOneInvokeOrigin(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${INVOKE_ORIGIN_ABSOLUTE_ERROR} (got ${raw})`);
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error(`${INVOKE_ORIGIN_ABSOLUTE_ERROR} (got ${raw})`);
  }
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_INVOKE_ORIGINS} entries must be origins without a path, query, or fragment (got ${raw})`,
    );
  }
  return new URL(parsed.origin);
}

function firstForwardedProto(req: IncomingMessage): string | undefined {
  const raw = req.headers['x-forwarded-proto'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value.split(',')[0]?.trim().toLowerCase();
}

/**
 * Request scheme for origin matching. `X-Forwarded-Proto` wins (first value),
 * then TLS socket, otherwise http. Non-https is treated as http.
 */
export function requestProtocol(req: IncomingMessage): 'http' | 'https' {
  const forwarded = firstForwardedProto(req);
  if (forwarded === 'https') {
    return 'https';
  }
  if (forwarded === 'http') {
    return 'http';
  }
  return 'encrypted' in req.socket && req.socket.encrypted === true ? 'https' : 'http';
}

export function originFromHostHeader(
  hostHeader: string | undefined,
  protocol: string,
): URL | undefined {
  if (hostHeader === undefined || hostHeader.length === 0) {
    return undefined;
  }
  try {
    return new URL(`${protocol === 'https' ? 'https' : 'http'}://${hostHeader}`);
  } catch {
    return undefined;
  }
}

/**
 * Extra MCP invoke origins (private load balancer, internal DNS, etc.).
 * Duplicates of `publicUrl` are skipped.
 */
export function parseInvokeOrigins(raw: string | undefined, publicUrl?: string): URL[] {
  if (raw === undefined || raw.trim() === '') {
    return [];
  }

  const seen = new Set<string>();
  if (publicUrl !== undefined && publicUrl.length > 0) {
    seen.add(new URL(publicUrl).origin);
  }

  const parsed: URL[] = [];
  for (const part of raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const origin = parseOneInvokeOrigin(part);
    if (seen.has(origin.origin)) {
      continue;
    }
    seen.add(origin.origin);
    parsed.push(origin);
  }
  return parsed;
}

export function matchInvokeOrigin(
  hostHeader: string | undefined,
  protocol: string,
  invokeOrigins: readonly URL[],
): URL | undefined {
  if (invokeOrigins.length === 0) {
    return undefined;
  }
  const fromHost = originFromHostHeader(hostHeader, protocol);
  if (fromHost === undefined) {
    return undefined;
  }
  return invokeOrigins.find((origin) => origin.origin === fromHost.origin);
}

function matchInvokeOriginFromRequest(
  req: IncomingMessage,
  invokeOrigins: readonly URL[],
): URL | undefined {
  return matchInvokeOrigin(req.headers.host, requestProtocol(req), invokeOrigins);
}

export function allowedResourceOrigins(publicUrl: string, invokeOrigins: readonly URL[]): string[] {
  return [new URL(publicUrl).origin, ...invokeOrigins.map((origin) => origin.origin)];
}

/** Public URL, or a matching extra invoke origin, with no trailing slash. */
export function resourceOriginForRequest(
  req: IncomingMessage,
  invokeOrigins: readonly URL[],
  publicUrl: string,
): string {
  const invoke = matchInvokeOriginFromRequest(req, invokeOrigins);
  if (invoke !== undefined) {
    return invoke.origin;
  }
  return new URL(publicUrl).origin;
}
