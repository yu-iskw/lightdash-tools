/**
 * Principal- and persona-scoped, process-local client capabilities cache (ADR-0019).
 *
 * Sessionless HTTP creates a fresh McpServer per POST, so initialize-declared
 * capabilities would otherwise be lost on tools/call. Cache is best-effort
 * same-replica (like in-memory OAuth); clients may also send per-request
 * `_meta[CLIENT_CAPABILITIES_META_KEY]`.
 *
 * Anonymous principals (shared-key / none with no subject or tokenHash) never
 * use the cache — last-writer-wins would cross clients on one process.
 *
 * OAuth clients are keyed by tokenHash (not subject) so concurrent MCP hosts
 * for the same user do not overwrite each other's capabilities. Per-request
 * `_meta[CLIENT_CAPABILITIES_META_KEY]` remains the multi-replica escape hatch.
 */

import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';

import type { ToolAuditAuthContext } from '../audit/tool-audit-context.js';
import type { ClientCapabilities, McpServer } from '@modelcontextprotocol/server';

export const CLIENT_CAPABILITIES_CACHE_TTL_MS = 30 * 60_000;

const ANONYMOUS_PRINCIPAL = 'anonymous';

type CacheEntry = {
  clientCapabilities: ClientCapabilities;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

/** Same shape as tool-audit auth; tokenHash → subject → anonymous. */
export type CapabilitiesPrincipal = ToolAuditAuthContext;

export function resolveCapabilitiesPrincipalKey(
  principal: CapabilitiesPrincipal,
  scope?: string,
): string {
  let key: string;
  if (typeof principal.tokenHash === 'string' && principal.tokenHash.length > 0) {
    key = `token:${principal.tokenHash}`;
  } else if (typeof principal.subject === 'string' && principal.subject.length > 0) {
    key = `subject:${principal.subject}`;
  } else {
    key = ANONYMOUS_PRINCIPAL;
  }
  if (typeof scope === 'string' && scope.length > 0) {
    return `${key}@${scope}`;
  }
  return key;
}

function hasCapabilitiesPrincipal(principal: CapabilitiesPrincipal): boolean {
  return (
    (typeof principal.tokenHash === 'string' && principal.tokenHash.length > 0) ||
    (typeof principal.subject === 'string' && principal.subject.length > 0)
  );
}

export function rememberClientCapabilities(
  principal: CapabilitiesPrincipal,
  clientCapabilities: ClientCapabilities,
  options?: { ttlMs?: number; scope?: string },
): void {
  if (!hasCapabilitiesPrincipal(principal)) {
    return;
  }
  const key = resolveCapabilitiesPrincipalKey(principal, options?.scope);
  const ttlMs = options?.ttlMs ?? CLIENT_CAPABILITIES_CACHE_TTL_MS;
  cache.set(key, {
    clientCapabilities,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getRememberedClientCapabilities(
  principal: CapabilitiesPrincipal,
  scope?: string,
): ClientCapabilities | undefined {
  if (!hasCapabilitiesPrincipal(principal)) {
    return undefined;
  }
  const key = resolveCapabilitiesPrincipalKey(principal, scope);
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.clientCapabilities;
}

export function resetClientCapabilitiesCacheForTests(): void {
  cache.clear();
}

type JsonRpcRequestLike = {
  method?: string;
  params?: {
    capabilities?: ClientCapabilities;
    _meta?: Record<string, unknown>;
  };
};

function asSingleJsonRpcRequest(body: unknown): JsonRpcRequestLike | undefined {
  // Streamable HTTP does not support JSON-RPC batches; ignore arrays here.
  if (body === undefined || body === null || Array.isArray(body)) {
    return undefined;
  }
  if (typeof body !== 'object') {
    return undefined;
  }
  return body as JsonRpcRequestLike;
}

/** Capabilities from initialize params or per-request `_meta` envelope. */
export function extractClientCapabilitiesFromBody(body: unknown): {
  clientCapabilities?: ClientCapabilities;
  fromInitialize: boolean;
} {
  const msg = asSingleJsonRpcRequest(body);
  if (!msg) {
    return { fromInitialize: false };
  }

  if (msg.method === 'initialize') {
    const caps = msg.params?.capabilities;
    return caps !== undefined
      ? { clientCapabilities: caps, fromInitialize: true }
      : { fromInitialize: true };
  }

  const meta = msg.params?._meta;
  if (meta !== undefined && typeof meta === 'object') {
    const fromMeta = Reflect.get(meta, CLIENT_CAPABILITIES_META_KEY) as
      ClientCapabilities | undefined;
    if (fromMeta !== undefined) {
      return { clientCapabilities: fromMeta, fromInitialize: false };
    }
  }

  return { fromInitialize: false };
}

/**
 * Seed connection-scoped client capabilities on a fresh per-request McpServer.
 * Mirrors SDK-internal seedClientIdentityFromEnvelope (not public on 2.0.0).
 */
export function seedClientCapabilitiesOntoServer(
  mcpServer: McpServer,
  clientCapabilities: ClientCapabilities | undefined,
): void {
  if (clientCapabilities === undefined) {
    return;
  }
  // SDK Server stores initialize-scoped identity privately; 2025-era elicitation
  // shim reads `_clientCapabilities` via getClientCapabilities().
  const lowLevel = mcpServer.server as unknown as {
    _clientCapabilities?: ClientCapabilities;
  };
  lowLevel._clientCapabilities = clientCapabilities;
}

/**
 * Remember initialize caps, or seed the fresh server from envelope meta / cache.
 * Call after createLightdashMcpServer, before transport.handleRequest.
 * On initialize, only cache — the SDK seeds this connection from params.
 * `scope` (e.g. persona.path) isolates cache entries across HTTP personas.
 */
export function prepareServerClientCapabilities(
  mcpServer: McpServer,
  body: unknown,
  principal: CapabilitiesPrincipal,
  scope?: string,
): void {
  const extracted = extractClientCapabilitiesFromBody(body);
  if (extracted.fromInitialize) {
    if (extracted.clientCapabilities !== undefined) {
      rememberClientCapabilities(principal, extracted.clientCapabilities, { scope });
    }
    return;
  }

  const caps = extracted.clientCapabilities ?? getRememberedClientCapabilities(principal, scope);
  seedClientCapabilitiesOntoServer(mcpServer, caps);
}
