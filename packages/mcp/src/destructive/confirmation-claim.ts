/**
 * One-shot claim for non-idempotent elicitation confirmations (e.g. promote).
 * Memory Map by default; Redis SET NX when LIGHTDASH_TOOLS_MCP_STORE=redis (ADR-0016).
 */

import { resolveEphemeralStoreConfig } from '../store/config.js';
import { getSharedRedisClient } from '../store/redis-client.js';

import type { DestructiveRequestState } from './types.js';

/** Longer than requestState TTL so an in-flight promote cannot be reclaimed mid-call. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const REDIS_KEY_PREFIX = 'lightdash-mcp:confirm-claim:';

const memoryClaims = new Map<string, number>();

function purgeExpiredMemory(now: number): void {
  for (const [key, expiresAt] of memoryClaims) {
    if (expiresAt <= now) {
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
 * Claim a confirmation key for one apply. Returns false if already claimed
 * within TTL (concurrent/replayed accept).
 */
export async function claimConfirmationKey(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<boolean> {
  const config = resolveEphemeralStoreConfig();
  if (config.backend === 'redis') {
    const redis = await getSharedRedisClient(config);
    const result = await redis.set(redisClaimKey(key), '1', { NX: true, PX: ttlMs });
    return result === 'OK';
  }

  const now = Date.now();
  purgeExpiredMemory(now);
  const existing = memoryClaims.get(key);
  if (existing !== undefined && existing > now) {
    return false;
  }
  memoryClaims.set(key, now + ttlMs);
  return true;
}

/** Release a claim so a confirmed no-write failure can be retried. */
export async function releaseConfirmationKey(key: string): Promise<void> {
  const config = resolveEphemeralStoreConfig();
  if (config.backend === 'redis') {
    const redis = await getSharedRedisClient(config);
    await redis.del(redisClaimKey(key));
    return;
  }
  memoryClaims.delete(key);
}

/** Reset memory claims (tests only). */
export function resetConfirmationClaimsForTests(): void {
  memoryClaims.clear();
}
