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
      expect(entry.contentHash).toBe(hashPreviewContent({ name: 'Foo' }));

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
        resourceKind: 'space',
        resourceKey: 'new',
        proposed: { name: 'Space' },
      });
      markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'space',
        resourceKey: 'new',
      });
      expectPreviewErrorCode(
        () =>
          consumeValidatedPreview({
            previewId: entry.previewId,
            sessionId: 's2',
            projectUuid: 'p1',
            resourceKind: 'space',
            resourceKey: 'new',
            proposed: { name: 'Space' },
          }),
        'PREVIEW_NOT_OWNED',
      );
    });
  });
});
