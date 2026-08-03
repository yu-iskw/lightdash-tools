/**
 * Principal-scoped, process-local client capabilities cache (ADR-0019).
 *
 * Sessionless HTTP creates a fresh McpServer per POST, so initialize-declared
 * capabilities would otherwise be lost on tools/call. Cache is best-effort
 * same-replica (like in-memory OAuth); clients may also send per-request
 * `_meta[CLIENT_CAPABILITIES_META_KEY]`.
 */

import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';

import type { ClientCapabilities, Implementation, McpServer } from '@modelcontextprotocol/server';

/** Default TTL for remembered initialize capabilities. */
export const CLIENT_CAPABILITIES_CACHE_TTL_MS = 30 * 60_000;

const ANONYMOUS_PRINCIPAL = 'anonymous';

type CachedIdentity = {
  clientCapabilities: ClientCapabilities;
  clientInfo?: Implementation;
  expiresAt: number;
};

const cache = new Map<string, CachedIdentity>();

export type CapabilitiesPrincipal = {
  subject?: string;
  tokenHash?: string;
};

/** Resolve cache key: subject → tokenHash → anonymous. */
export function resolveCapabilitiesPrincipalKey(principal: CapabilitiesPrincipal): string {
  if (typeof principal.subject === 'string' && principal.subject.length > 0) {
    return `subject:${principal.subject}`;
  }
  if (typeof principal.tokenHash === 'string' && principal.tokenHash.length > 0) {
    return `token:${principal.tokenHash}`;
  }
  return ANONYMOUS_PRINCIPAL;
}

export function rememberClientCapabilities(
  principal: CapabilitiesPrincipal,
  identity: {
    clientCapabilities: ClientCapabilities;
    clientInfo?: Implementation;
  },
  ttlMs: number = CLIENT_CAPABILITIES_CACHE_TTL_MS,
): void {
  const key = resolveCapabilitiesPrincipalKey(principal);
  cache.set(key, {
    clientCapabilities: identity.clientCapabilities,
    clientInfo: identity.clientInfo,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getRememberedClientCapabilities(
  principal: CapabilitiesPrincipal,
): CachedIdentity | undefined {
  const key = resolveCapabilitiesPrincipalKey(principal);
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

/** Test helper. */
export function resetClientCapabilitiesCacheForTests(): void {
  cache.clear();
}

type JsonRpcRequestLike = {
  method?: string;
  params?: {
    capabilities?: ClientCapabilities;
    clientInfo?: Implementation;
    _meta?: Record<string, unknown>;
  };
};

function asJsonRpcRequest(body: unknown): JsonRpcRequestLike | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  const msg = Array.isArray(body) ? body[0] : body;
  if (typeof msg !== 'object' || msg === null) {
    return undefined;
  }
  return msg as JsonRpcRequestLike;
}

/** Capabilities from initialize params or per-request `_meta` envelope. */
export function extractClientCapabilitiesFromBody(body: unknown): {
  clientCapabilities?: ClientCapabilities;
  clientInfo?: Implementation;
  fromInitialize: boolean;
} {
  const msg = asJsonRpcRequest(body);
  if (!msg) {
    return { fromInitialize: false };
  }

  if (msg.method === 'initialize' && msg.params?.capabilities !== undefined) {
    return {
      clientCapabilities: msg.params.capabilities,
      clientInfo: msg.params.clientInfo,
      fromInitialize: true,
    };
  }

  const meta = msg.params?._meta;
  if (meta !== undefined && typeof meta === 'object') {
    const fromMeta = Reflect.get(meta, CLIENT_CAPABILITIES_META_KEY) as
      ClientCapabilities | undefined;
    if (fromMeta !== undefined) {
      return {
        clientCapabilities: fromMeta,
        fromInitialize: false,
      };
    }
  }

  return { fromInitialize: false };
}

/**
 * Seed connection-scoped client identity on a fresh per-request McpServer.
 * Mirrors SDK-internal seedClientIdentityFromEnvelope (not public on 2.0.0).
 */
export function seedClientCapabilitiesOntoServer(
  mcpServer: McpServer,
  identity: {
    clientCapabilities?: ClientCapabilities;
    clientInfo?: Implementation;
  },
): void {
  if (identity.clientCapabilities === undefined && identity.clientInfo === undefined) {
    return;
  }
  // SDK Server stores initialize-scoped identity privately; 2025-era elicitation
  // shim reads `_clientCapabilities` via getClientCapabilities().
  const lowLevel = mcpServer.server as unknown as {
    _clientCapabilities?: ClientCapabilities;
    _clientVersion?: Implementation;
  };
  if (identity.clientCapabilities !== undefined) {
    lowLevel._clientCapabilities = identity.clientCapabilities;
  }
  if (identity.clientInfo !== undefined) {
    lowLevel._clientVersion = identity.clientInfo;
  }
}

/**
 * Remember initialize caps and/or seed the fresh server from envelope meta or cache.
 * Call after createLightdashMcpServer, before transport.handleRequest.
 */
export function prepareServerClientCapabilities(
  mcpServer: McpServer,
  body: unknown,
  principal: CapabilitiesPrincipal,
): void {
  const extracted = extractClientCapabilitiesFromBody(body);
  if (extracted.fromInitialize && extracted.clientCapabilities !== undefined) {
    rememberClientCapabilities(principal, {
      clientCapabilities: extracted.clientCapabilities,
      clientInfo: extracted.clientInfo,
    });
    seedClientCapabilitiesOntoServer(mcpServer, {
      clientCapabilities: extracted.clientCapabilities,
      clientInfo: extracted.clientInfo,
    });
    return;
  }

  if (extracted.clientCapabilities !== undefined) {
    seedClientCapabilitiesOntoServer(mcpServer, {
      clientCapabilities: extracted.clientCapabilities,
      clientInfo: extracted.clientInfo,
    });
    return;
  }

  const remembered = getRememberedClientCapabilities(principal);
  if (remembered) {
    seedClientCapabilitiesOntoServer(mcpServer, {
      clientCapabilities: remembered.clientCapabilities,
      clientInfo: remembered.clientInfo,
    });
  }
}
