/**
 * Redis-backed PreviewStore with Lua CAS (ADR-0016).
 *
 * Key prefix: `lightdash-tools:mcp:preview:`.
 * Redis key TTL = logical expiresAt + grace so assertOwnedEntry can still
 * distinguish PREVIEW_EXPIRED from PREVIEW_REQUIRED after logical expiry.
 */

import type { PreviewLedgerEntry, PreviewStatus, PreviewStore } from '../policy/preview-ledger.js';
import type { RedisClientType } from 'redis';

export const PREVIEW_REDIS_KEY_PREFIX = 'lightdash-tools:mcp:preview:';

/** Keep expired entries briefly so the ledger can return PREVIEW_EXPIRED. */
export const PREVIEW_REDIS_EXPIRY_GRACE_MS = 5 * 60 * 1000;

/** Atomic CAS: replace value only when current JSON status matches expected. */
const CAS_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
if decoded['status'] ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`;

/** Atomic delete when current JSON status matches expected. */
const CAS_DELETE_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
if decoded['status'] ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1])
return 1
`;

function previewKey(previewId: string): string {
  return `${PREVIEW_REDIS_KEY_PREFIX}${previewId}`;
}

/** Redis PX from logical expiresAt, including post-expiry grace. Exported for tests. */
export function redisTtlMsFromEntry(
  entry: PreviewLedgerEntry,
  now = Date.now(),
  graceMs = PREVIEW_REDIS_EXPIRY_GRACE_MS,
): number {
  const expires = Date.parse(entry.expiresAt);
  if (Number.isNaN(expires)) {
    return Math.max(1, graceMs);
  }
  return Math.max(1, expires - now + graceMs);
}

export class RedisPreviewStore implements PreviewStore {
  constructor(private readonly getClient: () => Promise<RedisClientType>) {}

  async get(previewId: string): Promise<PreviewLedgerEntry | undefined> {
    const client = await this.getClient();
    const raw = await client.get(previewKey(previewId));
    if (raw == null) {
      return undefined;
    }
    return JSON.parse(raw) as PreviewLedgerEntry;
  }

  async put(entry: PreviewLedgerEntry): Promise<void> {
    const client = await this.getClient();
    const ttlMs = redisTtlMsFromEntry(entry);
    await client.set(previewKey(entry.previewId), JSON.stringify(entry), { PX: ttlMs });
  }

  async compareAndSwap(
    previewId: string,
    expectedStatus: PreviewStatus,
    next: PreviewLedgerEntry,
  ): Promise<boolean> {
    if (next.previewId !== previewId) {
      return false;
    }
    const client = await this.getClient();
    const ttlMs = redisTtlMsFromEntry(next);
    const result = await client.eval(CAS_LUA, {
      keys: [previewKey(previewId)],
      arguments: [expectedStatus, JSON.stringify(next), String(ttlMs)],
    });
    return result === 1 || result === BigInt(1);
  }

  async compareAndDelete(previewId: string, expectedStatus: PreviewStatus): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.eval(CAS_DELETE_LUA, {
      keys: [previewKey(previewId)],
      arguments: [expectedStatus],
    });
    return result === 1 || result === BigInt(1);
  }

  async delete(previewId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(previewKey(previewId));
  }
}
