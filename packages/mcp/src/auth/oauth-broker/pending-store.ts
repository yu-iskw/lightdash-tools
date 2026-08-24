/**
 * OAuth broker pending / codes / DCR clients (ADR-0007 / ADR-0019).
 *
 * All values are JSON-serializable. Backend: in-memory only — process-local.
 * Multi-instance OAuth authorization/code exchange needs sticky `/oauth/*` or a single replica.
 * Issued MCP access tokens are self-contained and do not depend on this store after exchange.
 */

import { randomBytes } from 'node:crypto';

export interface PendingAuthorization {
  /** Broker state sent to Lightdash (opaque). */
  brokerState: string;
  /** MCP client's OAuth client_id (from DCR). */
  clientId: string;
  /** MCP client's redirect_uri (must match token exchange). */
  redirectUri: string;
  /** Optional MCP client state to echo back. */
  clientState?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  /** Exact RFC 8707 MCP protected-resource URI requested by the client. */
  resource: string;
  /** MCP authorization scope. This is not a downstream Lightdash scope. */
  scope?: string;
  /** CSRF nonce for POST /oauth/consent (not the broker state). */
  csrfToken: string;
  /** True after the user approves the consent page. Callback refuses otherwise. */
  consented: boolean;
  createdAt: number;
}

export interface IssuedAuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  /** Server-held downstream Lightdash access token; never return it directly to MCP clients. */
  accessToken: string;
  expiresIn?: number;
  tokenType: string;
  /** Exact RFC 8707 MCP protected-resource URI bound during authorization. */
  resource: string;
  /** MCP authorization scope. */
  scope?: string;
  createdAt: number;
}

export interface RegisteredClient {
  clientId: string;
  redirectUris: ReadonlySet<string>;
  /** Unverified DCR client_name (display only). */
  clientName?: string;
  createdAt: number;
}

/** Pending authorize→callback state TTL. */
export const DEFAULT_PENDING_TTL_MS = 10 * 60 * 1000;
/** Issued broker authorization code TTL (RFC 6749 recommends ≤10m; keep short). */
export const DEFAULT_CODE_TTL_MS = 60 * 1000;
/** Registered DCR clients TTL (long enough for interactive OAuth). */
export const DEFAULT_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_PENDING = 10_000;
export const DEFAULT_MAX_CODES = 10_000;
export const DEFAULT_MAX_CLIENTS = 10_000;

export type OAuthBrokerStoreOptions = {
  pendingTtlMs?: number;
  codeTtlMs?: number;
  clientTtlMs?: number;
  maxPending?: number;
  maxCodes?: number;
  maxClients?: number;
};

/**
 * OAuth broker ephemeral store (ADR-0019). In-memory only (process-local).
 * Async methods keep call sites await-uniform for future backends if needed.
 */
export interface OAuthBrokerStore {
  registerClient(
    redirectUris: readonly string[],
    clientName?: string,
  ): Promise<RegisteredClient | undefined>;
  getClient(clientId: string): Promise<RegisteredClient | undefined>;
  isRedirectAllowedForClient(clientId: string, redirectUri: string): Promise<boolean>;
  createPending(
    input: Omit<PendingAuthorization, 'brokerState' | 'consented' | 'createdAt' | 'csrfToken'>,
  ): Promise<PendingAuthorization | undefined>;
  getPending(brokerState: string): Promise<PendingAuthorization | undefined>;
  markConsented(brokerState: string): Promise<PendingAuthorization | undefined>;
  takePending(brokerState: string): Promise<PendingAuthorization | undefined>;
  /** Issues a one-time code only when `pending.consented` is true. */
  issueCode(
    pending: PendingAuthorization,
    tokens: {
      accessToken: string;
      expiresIn?: number;
      tokenType?: string;
    },
  ): Promise<IssuedAuthorizationCode | undefined>;
  /** Atomic get+delete for one-time code consume. */
  takeCode(code: string): Promise<IssuedAuthorizationCode | undefined>;
  /**
   * Re-insert a previously taken code with remaining TTL based on `createdAt`
   * and store `codeTtlMs`. Skips when already expired.
   */
  restoreCode(issued: IssuedAuthorizationCode): Promise<void>;
  /** Peek without consuming (tests / diagnostics). Prefer takeCode for grant paths. */
  getCode(code: string): Promise<IssuedAuthorizationCode | undefined>;
  deleteCode(code: string): Promise<void>;
}

/** In-memory pending OAuth broker state (single-instance / sticky routing). */
export class InMemoryOAuthBrokerStore implements OAuthBrokerStore {
  private readonly pendingByBrokerState = new Map<string, PendingAuthorization>();
  private readonly codes = new Map<string, IssuedAuthorizationCode>();
  private readonly clients = new Map<string, RegisteredClient>();
  private readonly pendingTtlMs: number;
  private readonly codeTtlMs: number;
  private readonly clientTtlMs: number;
  private readonly maxPending: number;
  private readonly maxCodes: number;
  private readonly maxClients: number;

  constructor(options: OAuthBrokerStoreOptions = {}) {
    this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.clientTtlMs = options.clientTtlMs ?? DEFAULT_CLIENT_TTL_MS;
    this.maxPending = options.maxPending ?? DEFAULT_MAX_PENDING;
    this.maxCodes = options.maxCodes ?? DEFAULT_MAX_CODES;
    this.maxClients = options.maxClients ?? DEFAULT_MAX_CLIENTS;
  }

  /**
   * Registers a public MCP client with exact redirect URIs, or returns undefined
   * when the in-memory client cap is reached (after TTL cleanup).
   */
  async registerClient(
    redirectUris: readonly string[],
    clientName?: string,
  ): Promise<RegisteredClient | undefined> {
    this.cleanup();
    if (this.clients.size >= this.maxClients) {
      return undefined;
    }
    const trimmedName = clientName?.trim();
    const client: RegisteredClient = {
      clientId: randomBytes(16).toString('base64url'),
      redirectUris: new Set(redirectUris),
      clientName: trimmedName && trimmedName.length > 0 ? trimmedName : undefined,
      createdAt: Date.now(),
    };
    this.clients.set(client.clientId, client);
    return client;
  }

  async getClient(clientId: string): Promise<RegisteredClient | undefined> {
    this.cleanup();
    return this.clients.get(clientId);
  }

  /** True when clientId is registered and redirectUri is an exact registered URI. */
  async isRedirectAllowedForClient(clientId: string, redirectUri: string): Promise<boolean> {
    const client = await this.getClient(clientId);
    return client !== undefined && client.redirectUris.has(redirectUri);
  }

  /**
   * Creates pending state, or returns undefined when the in-memory cap is reached
   * (after TTL cleanup).
   */
  async createPending(
    input: Omit<PendingAuthorization, 'brokerState' | 'consented' | 'createdAt' | 'csrfToken'>,
  ): Promise<PendingAuthorization | undefined> {
    this.cleanup();
    if (this.pendingByBrokerState.size >= this.maxPending) {
      return undefined;
    }
    const pending: PendingAuthorization = {
      ...input,
      brokerState: randomBytes(24).toString('base64url'),
      csrfToken: randomBytes(32).toString('base64url'),
      consented: false,
      createdAt: Date.now(),
    };
    this.pendingByBrokerState.set(pending.brokerState, pending);
    return pending;
  }

  async getPending(brokerState: string): Promise<PendingAuthorization | undefined> {
    this.cleanup();
    return this.pendingByBrokerState.get(brokerState);
  }

  async markConsented(brokerState: string): Promise<PendingAuthorization | undefined> {
    this.cleanup();
    const pending = this.pendingByBrokerState.get(brokerState);
    if (!pending) return undefined;
    const next: PendingAuthorization = { ...pending, consented: true };
    this.pendingByBrokerState.set(brokerState, next);
    return next;
  }

  async takePending(brokerState: string): Promise<PendingAuthorization | undefined> {
    this.cleanup();
    const pending = this.pendingByBrokerState.get(brokerState);
    if (!pending) return undefined;
    this.pendingByBrokerState.delete(brokerState);
    return pending;
  }

  async issueCode(
    pending: PendingAuthorization,
    tokens: {
      accessToken: string;
      expiresIn?: number;
      tokenType?: string;
    },
  ): Promise<IssuedAuthorizationCode | undefined> {
    this.cleanup();
    if (!pending.consented) {
      return undefined;
    }
    if (this.codes.size >= this.maxCodes) {
      return undefined;
    }
    const issued: IssuedAuthorizationCode = {
      code: randomBytes(32).toString('base64url'),
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: pending.codeChallengeMethod,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType ?? 'Bearer',
      resource: pending.resource,
      scope: pending.scope,
      createdAt: Date.now(),
    };
    this.codes.set(issued.code, issued);
    return issued;
  }

  /** Atomic get+delete of an issued authorization code. */
  async takeCode(code: string): Promise<IssuedAuthorizationCode | undefined> {
    this.cleanup();
    const issued = this.codes.get(code);
    if (!issued) return undefined;
    this.codes.delete(code);
    return issued;
  }

  /**
   * Re-insert a taken code if its original TTL has not elapsed.
   * In-memory expiry still uses `createdAt` + `codeTtlMs` on cleanup.
   */
  async restoreCode(issued: IssuedAuthorizationCode): Promise<void> {
    const remaining = this.codeTtlMs - (Date.now() - issued.createdAt);
    if (remaining <= 0) {
      return;
    }
    this.codes.set(issued.code, issued);
  }

  /** Peek at an issued code without consuming it. */
  async getCode(code: string): Promise<IssuedAuthorizationCode | undefined> {
    this.cleanup();
    return this.codes.get(code);
  }

  /** Drop a code by id (non-atomic; prefer takeCode for grant paths). */
  async deleteCode(code: string): Promise<void> {
    this.codes.delete(code);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingByBrokerState) {
      if (now - value.createdAt > this.pendingTtlMs) {
        this.pendingByBrokerState.delete(key);
      }
    }
    for (const [key, value] of this.codes) {
      if (now - value.createdAt > this.codeTtlMs) {
        this.codes.delete(key);
      }
    }
    for (const [key, value] of this.clients) {
      if (now - value.createdAt > this.clientTtlMs) {
        this.clients.delete(key);
      }
    }
  }
}
