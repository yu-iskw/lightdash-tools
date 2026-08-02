import { describe, expect, it } from 'vitest';

import { PREVIEW_REDIS_EXPIRY_GRACE_MS, redisTtlMsFromEntry } from './redis-preview-store.js';

import type { PreviewLedgerEntry } from '../policy/preview-ledger.js';

function entry(expiresAt: string): PreviewLedgerEntry {
  return {
    previewId: 'p1',
    sessionId: 's1',
    projectUuid: 'proj',
    resourceKind: 'chart',
    resourceKey: 'c1',
    resourceAliases: ['c1'],
    contentHash: 'h',
    status: 'draft',
    proposed: {},
    createdAt: new Date(0).toISOString(),
    expiresAt,
  };
}

describe('redisTtlMsFromEntry', () => {
  it('includes grace after logical expiry so entries remain readable', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const expiresAt = '2026-08-02T11:59:00.000Z'; // 60s before now
    const ttl = redisTtlMsFromEntry(entry(expiresAt), now);
    expect(ttl).toBe(PREVIEW_REDIS_EXPIRY_GRACE_MS - 60_000);
  });

  it('adds grace on top of remaining lifetime', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const expiresAt = '2026-08-02T12:05:00.000Z'; // 5 minutes left
    const ttl = redisTtlMsFromEntry(entry(expiresAt), now);
    expect(ttl).toBe(5 * 60_000 + PREVIEW_REDIS_EXPIRY_GRACE_MS);
  });

  it('never returns less than 1ms', () => {
    const now = Date.parse('2026-08-02T12:00:00.000Z');
    const expiresAt = '2026-08-01T00:00:00.000Z';
    const ttl = redisTtlMsFromEntry(entry(expiresAt), now, 0);
    expect(ttl).toBe(1);
  });
});
