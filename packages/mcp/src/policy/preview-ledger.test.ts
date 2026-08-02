import { beforeEach, describe, expect, it } from 'vitest';

import {
  PreviewLedgerError,
  addPreviewLedgerEntry,
  consumeValidatedPreview,
  getOwnedPreview,
  hashPreviewContent,
  markPreviewValidated,
  resetPreviewLedgerForTests,
} from './preview-ledger.js';

function expectPreviewErrorCode(fn: () => unknown, code: PreviewLedgerError['code']): void {
  try {
    fn();
    expect.unreachable('expected PreviewLedgerError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(PreviewLedgerError);
    expect((err as PreviewLedgerError).code).toBe(code);
  }
}

describe('preview-ledger', () => {
  beforeEach(() => {
    resetPreviewLedgerForTests();
  });

  describe('hashPreviewContent', () => {
    it('is stable regardless of key order', () => {
      const a = hashPreviewContent({ name: 'foo', description: 'bar' });
      const b = hashPreviewContent({ description: 'bar', name: 'foo' });
      expect(a).toBe(b);
    });

    it('differs when values differ', () => {
      const a = hashPreviewContent({ name: 'foo' });
      const b = hashPreviewContent({ name: 'bar' });
      expect(a).not.toBe(b);
    });

    it('hashes nested objects and arrays consistently', () => {
      const a = hashPreviewContent({ tiles: [{ x: 1, y: 2 }], meta: { z: 'q' } });
      const b = hashPreviewContent({ meta: { z: 'q' }, tiles: [{ y: 2, x: 1 }] });
      expect(a).toBe(b);
    });
  });

  describe('addPreviewLedgerEntry / getOwnedPreview', () => {
    it('stores a draft entry with a computed content hash', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(entry.status).toBe('draft');
      expect(entry.contentHash).toBe(
        hashPreviewContent({ proposed: { name: 'Foo' }, baseline: null }),
      );
      expect(entry.resourceAliases).toEqual(['my-slug']);

      const owned = getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(owned.resourceKey).toBe('my-slug');
    });

    it('rejects lookups from another session', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's2', projectUuid: 'p1' }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('rejects lookups from another project', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p2' }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('expires entries after ttlMs', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
        ttlMs: -1,
      });
      expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_EXPIRED',
      );
    });

    it('rejects an unknown previewId', () => {
      expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: 'missing', sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_REQUIRED',
      );
    });
  });

  describe('markPreviewValidated', () => {
    it('transitions a draft preview to validated when the expected resource matches', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
        proposed: { name: 'Dash' },
      });
      const validated = markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
      });
      expect(validated.status).toBe('validated');
    });

    it('rejects a mismatched resourceKind (bound validation)', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
        proposed: { name: 'Dash' },
      });
      expectPreviewErrorCode(
        () =>
          markPreviewValidated(entry.previewId, 's1', 'p1', {
            resourceKind: 'chart',
            resourceKey: 'dash-1',
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects a mismatched resourceKey (bound validation)', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-1',
        proposed: { name: 'Chart' },
      });
      expectPreviewErrorCode(
        () =>
          markPreviewValidated(entry.previewId, 's1', 'p1', {
            resourceKind: 'chart',
            resourceKey: 'chart-2',
          }),
        'PREVIEW_STALE',
      );
    });

    it('accepts an alias resourceKey (uuid ↔ slug)', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Chart' },
      });
      const validated = markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'revenue-kpi',
      });
      expect(validated.status).toBe('validated');
    });
  });

  describe('consumeValidatedPreview', () => {
    it('consumes a validated preview when kind/key/hash match', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });

      const consumed = consumeValidatedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(consumed.previewId).toBe(entry.previewId);

      // single-use: consuming again fails because the entry is gone
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
            proposed: { name: 'Foo' },
          }),
        'PREVIEW_REQUIRED',
      );
    });

    it('rejects a draft (not yet validated) preview', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
            proposed: { name: 'Foo' },
          }),
        'PREVIEW_NOT_VALIDATED',
      );
    });

    it('rejects a mismatched resourceKind/resourceKey (stale target)', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'other-slug',
            proposed: { name: 'Foo' },
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects a drifted payload (content hash mismatch)', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
            proposed: { name: 'Changed after preview' },
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects consumption from a different session', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'a,b',
        proposed: { itemUuids: ['a', 'b'], targetSpaceUuid: 's1' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'content-move',
        resourceKey: 'a,b',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's2',
            projectUuid: 'p1',
            resourceKind: 'content-move',
            resourceKey: 'a,b',
            proposed: { itemUuids: ['a', 'b'], targetSpaceUuid: 's1' },
          }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('consumes by alias resourceKey when uuid was stored as primary', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      const consumed = consumeValidatedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'revenue-kpi',
        proposed: { name: 'Foo' },
      });
      expect(consumed.resourceKey).toBe('chart-uuid-1');
    });

    it('rejects when baseline updatedAt drifted at apply time', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Foo' },
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z', uuid: 'chart-uuid-1' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'revenue-kpi',
            proposed: { name: 'Foo' },
            currentBaseline: { updatedAt: '2026-08-02T00:00:00.000Z', uuid: 'chart-uuid-1' },
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects when baseline was captured but currentBaseline is missing at apply', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        proposed: { name: 'Foo' },
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'chart-uuid-1',
            proposed: { name: 'Foo' },
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects create previews when a resource appears before apply', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'new-slug',
            proposed: { name: 'Foo' },
            currentBaseline: { uuid: 'appeared-after-preview', slug: 'new-slug' },
          }),
        'PREVIEW_STALE',
      );
    });

    it('allows create previews when the target is still absent at apply', () => {
      const entry = addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      const consumed = consumeValidatedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      expect(consumed.resourceKey).toBe('new-slug');
    });
  });
});
