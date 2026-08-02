/**
 * OAuth broker pending / codes / DCR clients (ADR-0007 / ADR-0016).
 *
 * All values are JSON-serializable (redirect URI sets become string arrays on Redis).
 * Backends: in-memory (default) or Redis via `createOAuthBrokerStore` — full multi-instance
 * handoff for authorize → callback → token when STORE=redis.
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
  scope?: string;
  createdAt: number;
}

export interface IssuedAuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  accessToken: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
  createdAt: number;
}

export interface RegisteredClient {
  clientId: string;
  redirectUris: ReadonlySet<string>;
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
 * Pluggable OAuth broker ephemeral store (ADR-0016).
 * All methods are async so Redis and memory share one call-site shape.
 */
export interface OAuthBrokerStore {
  registerClient(redirectUris: readonly string[]): Promise<RegisteredClient | undefined>;
  getClient(clientId: string): Promise<RegisteredClient | undefined>;
  isRedirectAllowedForClient(clientId: string, redirectUri: string): Promise<boolean>;
  createPending(
    input: Omit<PendingAuthorization, 'brokerState' | 'createdAt'>,
  ): Promise<PendingAuthorization | undefined>;
  takePending(brokerState: string): Promise<PendingAuthorization | undefined>;
  issueCode(
    pending: PendingAuthorization,
    tokens: {
      accessToken: string;
      expiresIn?: number;
      tokenType?: string;
      scope?: string;
    },
  ): Promise<IssuedAuthorizationCode | undefined>;
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
  async registerClient(redirectUris: readonly string[]): Promise<RegisteredClient | undefined> {
    this.cleanup();
    if (this.clients.size >= this.maxClients) {
      return undefined;
    }
    const client: RegisteredClient = {
      clientId: randomBytes(16).toString('base64url'),
      redirectUris: new Set(redirectUris),
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
    input: Omit<PendingAuthorization, 'brokerState' | 'createdAt'>,
  ): Promise<PendingAuthorization | undefined> {
    this.cleanup();
    if (this.pendingByBrokerState.size >= this.maxPending) {
      return undefined;
    }
    const pending: PendingAuthorization = {
      ...input,
      brokerState: randomBytes(24).toString('base64url'),
      createdAt: Date.now(),
    };
    this.pendingByBrokerState.set(pending.brokerState, pending);
    return pending;
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
      scope?: string;
    },
  ): Promise<IssuedAuthorizationCode | undefined> {
    this.cleanup();
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
      scope: tokens.scope ?? pending.scope,
      createdAt: Date.now(),
    };
    this.codes.set(issued.code, issued);
    return issued;
  }

  /** Peek at an issued code without consuming it (for pre-consume validation). */
  async getCode(code: string): Promise<IssuedAuthorizationCode | undefined> {
    this.cleanup();
    return this.codes.get(code);
  }

  /** Drop a previously peeked code after successful validation. */
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
