/**
 * Redis-backed OAuthBrokerStore (ADR-0016).
 *
 * Fully serializable pending state, authorization codes, and DCR clients —
 * the high-value multi-instance fix for authorize → callback → token.
 *
 * Key prefix: `lightdash-tools:mcp:oauth:`.
 * DCR clients are capacity-capped via a ZSET index (same contract as in-memory maxClients).
 */

import { randomBytes } from 'node:crypto';

import {
  DEFAULT_CLIENT_TTL_MS,
  DEFAULT_CODE_TTL_MS,
  DEFAULT_MAX_CLIENTS,
  DEFAULT_PENDING_TTL_MS,
  type IssuedAuthorizationCode,
  type OAuthBrokerStore,
  type OAuthBrokerStoreOptions,
  type PendingAuthorization,
  type RegisteredClient,
} from '../auth/oauth-broker/pending-store.js';

import type { RedisClientType } from 'redis';

export const OAUTH_REDIS_KEY_PREFIX = 'lightdash-tools:mcp:oauth:';
export const OAUTH_CLIENTS_INDEX_KEY = `${OAUTH_REDIS_KEY_PREFIX}clients`;

type ClientWire = {
  clientId: string;
  redirectUris: string[];
  createdAt: number;
};

/**
 * Atomic DCR register: prune expired index members, enforce maxClients, then
 * SET client key + ZADD index (score = absolute expiry ms).
 * Returns 1 on success, 0 when at capacity.
 */
export const REGISTER_CLIENT_LUA = `
local indexKey = KEYS[1]
local clientKey = KEYS[2]
local now = tonumber(ARGV[1])
local maxClients = tonumber(ARGV[2])
local ttlMs = tonumber(ARGV[3])
local clientJson = ARGV[4]
local clientId = ARGV[5]
local expiresAt = now + ttlMs
redis.call('ZREMRANGEBYSCORE', indexKey, '-inf', now)
if redis.call('ZCARD', indexKey) >= maxClients then
  return 0
end
redis.call('SET', clientKey, clientJson, 'PX', ttlMs)
redis.call('ZADD', indexKey, expiresAt, clientId)
return 1
`;

function pendingKey(brokerState: string): string {
  return `${OAUTH_REDIS_KEY_PREFIX}pending:${brokerState}`;
}

function codeKey(code: string): string {
  return `${OAUTH_REDIS_KEY_PREFIX}code:${code}`;
}

function clientKey(clientId: string): string {
  return `${OAUTH_REDIS_KEY_PREFIX}client:${clientId}`;
}

function toRegisteredClient(wire: ClientWire): RegisteredClient {
  return {
    clientId: wire.clientId,
    redirectUris: new Set(wire.redirectUris),
    createdAt: wire.createdAt,
  };
}

export class RedisOAuthBrokerStore implements OAuthBrokerStore {
  private readonly pendingTtlMs: number;
  private readonly codeTtlMs: number;
  private readonly clientTtlMs: number;
  private readonly maxClients: number;

  constructor(
    private readonly resolveRedis: () => Promise<RedisClientType>,
    options: OAuthBrokerStoreOptions = {},
  ) {
    this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.clientTtlMs = options.clientTtlMs ?? DEFAULT_CLIENT_TTL_MS;
    this.maxClients = options.maxClients ?? DEFAULT_MAX_CLIENTS;
  }

  async registerClient(redirectUris: readonly string[]): Promise<RegisteredClient | undefined> {
    const clientId = randomBytes(16).toString('base64url');
    const wire: ClientWire = {
      clientId,
      redirectUris: [...redirectUris],
      createdAt: Date.now(),
    };
    const redis = await this.resolveRedis();
    const result = await redis.eval(REGISTER_CLIENT_LUA, {
      keys: [OAUTH_CLIENTS_INDEX_KEY, clientKey(clientId)],
      arguments: [
        String(Date.now()),
        String(this.maxClients),
        String(this.clientTtlMs),
        JSON.stringify(wire),
        clientId,
      ],
    });
    if (result !== 1 && result !== BigInt(1)) {
      return undefined;
    }
    return toRegisteredClient(wire);
  }

  async getClient(clientId: string): Promise<RegisteredClient | undefined> {
    const redis = await this.resolveRedis();
    const raw = await redis.get(clientKey(clientId));
    if (raw == null) {
      return undefined;
    }
    return toRegisteredClient(JSON.parse(raw) as ClientWire);
  }

  async isRedirectAllowedForClient(clientId: string, redirectUri: string): Promise<boolean> {
    const registered = await this.getClient(clientId);
    return registered !== undefined && registered.redirectUris.has(redirectUri);
  }

  async createPending(
    input: Omit<PendingAuthorization, 'brokerState' | 'createdAt'>,
  ): Promise<PendingAuthorization | undefined> {
    const pending: PendingAuthorization = {
      ...input,
      brokerState: randomBytes(24).toString('base64url'),
      createdAt: Date.now(),
    };
    const redis = await this.resolveRedis();
    await redis.set(pendingKey(pending.brokerState), JSON.stringify(pending), {
      PX: this.pendingTtlMs,
    });
    return pending;
  }

  async takePending(brokerState: string): Promise<PendingAuthorization | undefined> {
    const redis = await this.resolveRedis();
    const key = pendingKey(brokerState);
    // Atomic consume (Redis 6.2+ GETDEL).
    const raw = await redis.getDel(key);
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as PendingAuthorization;
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
    const redis = await this.resolveRedis();
    await redis.set(codeKey(issued.code), JSON.stringify(issued), { PX: this.codeTtlMs });
    return issued;
  }

  async takeCode(code: string): Promise<IssuedAuthorizationCode | undefined> {
    const redis = await this.resolveRedis();
    // Atomic consume (Redis 6.2+ GETDEL) — same pattern as takePending.
    const raw = await redis.getDel(codeKey(code));
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as IssuedAuthorizationCode;
  }

  async restoreCode(issued: IssuedAuthorizationCode): Promise<void> {
    const remaining = this.codeTtlMs - (Date.now() - issued.createdAt);
    if (remaining <= 0) {
      return;
    }
    const redis = await this.resolveRedis();
    await redis.set(codeKey(issued.code), JSON.stringify(issued), {
      PX: Math.max(1, remaining),
    });
  }

  async getCode(code: string): Promise<IssuedAuthorizationCode | undefined> {
    const redis = await this.resolveRedis();
    const raw = await redis.get(codeKey(code));
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as IssuedAuthorizationCode;
  }

  async deleteCode(code: string): Promise<void> {
    const redis = await this.resolveRedis();
    await redis.del(codeKey(code));
  }
}
