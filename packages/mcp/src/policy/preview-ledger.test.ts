import { beforeEach, describe, expect, it } from 'vitest';

import {
  PreviewLedgerError,
  addPreviewLedgerEntry,
  claimPreviewForApply,
  hashPreviewContent,
  markPreviewApplied,
  markPreviewValidated,
  resetPreviewLedgerForTests,
} from './preview-ledger.js';

async function expectPreviewErrorCode(
  fn: () => Promise<unknown>,
  code: PreviewLedgerError['code'],
): Promise<void> {
  try {
    await fn();
    expect.unreachable('expected PreviewLedgerError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(PreviewLedgerError);
    expect((err as PreviewLedgerError).code).toBe(code);
  }
}

async function claimAndApply(
  input: Parameters<typeof claimPreviewForApply>[0],
): Promise<Awaited<ReturnType<typeof claimPreviewForApply>>> {
  const claimed = await claimPreviewForApply(input);
  await markPreviewApplied(claimed.previewId);
  return claimed;
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

  describe('claimPreviewForApply + markPreviewApplied', () => {
    it('consumes a validated preview when kind/key/hash match', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });

      const claimed = await claimAndApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(claimed.previewId).toBe(entry.previewId);
      expect(claimed.status).toBe('applying');

      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects a draft (not yet validated) preview', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects a mismatched resourceKind/resourceKey (stale target)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects a drifted payload (content hash mismatch)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects consumption from a different session', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'a,b',
        proposed: { itemUuids: ['a', 'b'], targetSpaceUuid: 's1' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'content-move',
        resourceKey: 'a,b',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('consumes by alias resourceKey when uuid was stored as primary', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      const claimed = await claimAndApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'revenue-kpi',
        proposed: { name: 'Foo' },
      });
      expect(claimed.resourceKey).toBe('chart-uuid-1');
    });

    it('rejects when baseline updatedAt drifted at apply time', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Foo' },
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z', uuid: 'chart-uuid-1' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects when baseline was captured but currentBaseline is missing at apply', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        proposed: { name: 'Foo' },
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('rejects create previews when a resource appears before apply', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      await expectPreviewErrorCode(
        () =>
          claimAndApply({
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

    it('allows create previews when the target is still absent at apply', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      const claimed = await claimAndApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed: { name: 'Foo' },
      });
      expect(claimed.resourceKey).toBe('new-slug');
    });
  });
});
