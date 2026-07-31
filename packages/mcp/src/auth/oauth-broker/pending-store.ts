import { randomBytes } from 'node:crypto';

export interface PendingAuthorization {
  /** Broker state sent to Lightdash (opaque). */
  brokerState: string;
  /** MCP client's OAuth client_id (public / DCR stub). */
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
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
  createdAt: number;
}

/** Pending authorize→callback state TTL. */
const DEFAULT_PENDING_TTL_MS = 10 * 60 * 1000;
/** Issued broker authorization code TTL (RFC 6749 recommends ≤10m; keep short). */
const DEFAULT_CODE_TTL_MS = 60 * 1000;
const DEFAULT_MAX_PENDING = 10_000;
const DEFAULT_MAX_CODES = 10_000;

/** In-memory pending OAuth broker state (single-instance / sticky routing). */
export class OAuthBrokerStore {
  private readonly pendingByBrokerState = new Map<string, PendingAuthorization>();
  private readonly codes = new Map<string, IssuedAuthorizationCode>();
  private readonly pendingTtlMs: number;
  private readonly codeTtlMs: number;
  private readonly maxPending: number;
  private readonly maxCodes: number;

  constructor(
    options: {
      pendingTtlMs?: number;
      codeTtlMs?: number;
      maxPending?: number;
      maxCodes?: number;
    } = {},
  ) {
    this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.maxPending = options.maxPending ?? DEFAULT_MAX_PENDING;
    this.maxCodes = options.maxCodes ?? DEFAULT_MAX_CODES;
  }

  /**
   * Creates pending state, or returns undefined when the in-memory cap is reached
   * (after TTL cleanup).
   */
  createPending(
    input: Omit<PendingAuthorization, 'brokerState' | 'createdAt'>,
  ): PendingAuthorization | undefined {
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

  takePending(brokerState: string): PendingAuthorization | undefined {
    this.cleanup();
    const pending = this.pendingByBrokerState.get(brokerState);
    if (!pending) return undefined;
    this.pendingByBrokerState.delete(brokerState);
    return pending;
  }

  issueCode(
    pending: PendingAuthorization,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      tokenType?: string;
      scope?: string;
    },
  ): IssuedAuthorizationCode | undefined {
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
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType ?? 'Bearer',
      scope: tokens.scope ?? pending.scope,
      createdAt: Date.now(),
    };
    this.codes.set(issued.code, issued);
    return issued;
  }

  /** Peek at an issued code without consuming it (for pre-consume validation). */
  getCode(code: string): IssuedAuthorizationCode | undefined {
    this.cleanup();
    return this.codes.get(code);
  }

  /** Drop a previously peeked code after successful validation. */
  deleteCode(code: string): void {
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
  }
}
