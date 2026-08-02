/**
 * Deterministic JSON stringify for digests and diffs (persona-neutral).
 */

import { createHash } from 'node:crypto';

/** True for plain objects (not null, not arrays). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      // eslint-disable-next-line security/detect-object-injection -- key comes from Object.keys of the same record
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** Stable JSON stringify (sorted object keys); structurally-equal values serialize identically. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** SHA-256 hex digest of `stableStringify(value)` for precondition / preview hashes. */
export function hashStableValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
