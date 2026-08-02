/**
 * One-shot claim for non-idempotent elicitation confirmations (e.g. promote).
 * Process-local Map (same default durability as in-memory preview store).
 */

import type { DestructiveRequestState } from './types.js';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

const claims = new Map<string, number>();

function purgeExpired(now: number): void {
  for (const [key, expiresAt] of claims) {
    if (expiresAt <= now) {
      claims.delete(key);
    }
  }
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
export function claimConfirmationKey(key: string, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const now = Date.now();
  purgeExpired(now);
  const existing = claims.get(key);
  if (existing !== undefined && existing > now) {
    return false;
  }
  claims.set(key, now + ttlMs);
  return true;
}

/** Release a claim so a failed apply can be retried with the same confirmation. */
export function releaseConfirmationKey(key: string): void {
  claims.delete(key);
}

/** Reset claims (tests only). */
export function resetConfirmationClaimsForTests(): void {
  claims.clear();
}
