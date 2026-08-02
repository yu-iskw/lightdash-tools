/**
 * One-shot claim for non-idempotent elicitation confirmations (e.g. promote).
 * Memory Map by default; Redis SET NX when LIGHTDASH_TOOLS_MCP_STORE=redis (ADR-0016).
 * Releases are compare-and-delete so a late cleanup cannot erase a newer claimant.
 */

import { randomUUID } from 'node:crypto';

import { resolveEphemeralStoreConfig } from '../store/config.js';
import { getSharedRedisClient } from '../store/redis-client.js';

import type { DestructiveRequestState } from './types.js';

/** Longer than requestState TTL so an in-flight promote cannot be reclaimed mid-call. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const REDIS_KEY_PREFIX = 'lightdash-mcp:confirm-claim:';

/** Compare-and-delete: only remove if the value still matches our claim token. */
const REDIS_RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

type MemoryClaim = { token: string; expiresAt: number };

const memoryClaims = new Map<string, MemoryClaim>();

export type ConfirmationClaimHandle = {
  key: string;
  token: string;
};

function purgeExpiredMemory(now: number): void {
  for (const [key, claim] of memoryClaims) {
    if (claim.expiresAt <= now) {
      memoryClaims.delete(key);
    }
  }
}

function redisClaimKey(key: string): string {
  return `${REDIS_KEY_PREFIX}${key}`;
}

/** Stable key for a verified confirmation binding. */
export function confirmationClaimKey(state: DestructiveRequestState): string {
  return [
    state.sessionId,
    state.operationId,
    state.resourceType,
    state.resourceId,
    state.projectUuid,
    state.preconditionDigest,
  ].join('\0');
}

/**
 * Claim a confirmation key for one apply. Returns undefined if already claimed
 * within TTL (concurrent/replayed accept).
 */
export async function claimConfirmationKey(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<ConfirmationClaimHandle | undefined> {
  const token = randomUUID();
  const config = resolveEphemeralStoreConfig();
  if (config.backend === 'redis') {
    const redis = await getSharedRedisClient(config);
    const result = await redis.set(redisClaimKey(key), token, { NX: true, PX: ttlMs });
    return result === 'OK' ? { key, token } : undefined;
  }

  const now = Date.now();
  purgeExpiredMemory(now);
  const existing = memoryClaims.get(key);
  if (existing !== undefined && existing.expiresAt > now) {
    return undefined;
  }
  memoryClaims.set(key, { token, expiresAt: now + ttlMs });
  return { key, token };
}

/** Release only if this handle still owns the claim (compare-and-delete). */
export async function releaseConfirmationKey(handle: ConfirmationClaimHandle): Promise<void> {
  const config = resolveEphemeralStoreConfig();
  if (config.backend === 'redis') {
    const redis = await getSharedRedisClient(config);
    await redis.eval(REDIS_RELEASE_LUA, {
      keys: [redisClaimKey(handle.key)],
      arguments: [handle.token],
    });
    return;
  }
  const current = memoryClaims.get(handle.key);
  if (current?.token === handle.token) {
    memoryClaims.delete(handle.key);
  }
}

/** Reset memory claims (tests only). */
export function resetConfirmationClaimsForTests(): void {
  memoryClaims.clear();
}
