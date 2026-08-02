import { LightdashApiError, NetworkError, RateLimitError } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { setPreviewStoreForTests } from '../store/create-preview-store.js';
import { InMemoryPreviewStore } from '../store/in-memory-preview-store.js';

import {
  PreviewLedgerError,
  addPreviewLedgerEntry,
  claimPreviewForApply,
  classifyMutationFailure,
  getOwnedPreview,
  hashPreviewContent,
  markPreviewApplied,
  markPreviewValidated,
  releaseOrReconcilePreview,
  resetPreviewLedgerForTests,
  withClaimedPreviewApply,
} from './preview-ledger.js';

import type { ApiErrorPayload } from '@lightdash-tools/client';
import type { PreviewLedgerEntry, PreviewStatus, PreviewStore } from './preview-ledger.js';

function apiError(statusCode: number): LightdashApiError {
  const payload: ApiErrorPayload['error'] = {
    name: 'ApiError',
    statusCode,
    message: `status ${statusCode}`,
  };
  return new LightdashApiError(statusCode, payload, {});
}

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

describe('preview-ledger state machine and faults', () => {
  beforeEach(() => {
    resetPreviewLedgerForTests();
  });

  describe('classifyMutationFailure', () => {
    it('releases on typical 4xx client errors', () => {
      expect(classifyMutationFailure(apiError(400))).toBe('release');
      expect(classifyMutationFailure(apiError(403))).toBe('release');
      expect(classifyMutationFailure(apiError(404))).toBe('release');
      expect(classifyMutationFailure(apiError(422))).toBe('release');
    });

    it('reconciles on 408, 429 (api + RateLimitError), 5xx, network, and unknown', () => {
      expect(classifyMutationFailure(apiError(408))).toBe('reconcile');
      expect(classifyMutationFailure(apiError(429))).toBe('reconcile');
      expect(classifyMutationFailure(apiError(500))).toBe('reconcile');
      expect(classifyMutationFailure(apiError(502))).toBe('reconcile');
      expect(
        classifyMutationFailure(
          new RateLimitError(429, { name: 'RateLimit', statusCode: 429 }, {}),
        ),
      ).toBe('reconcile');
      expect(classifyMutationFailure(new NetworkError('down', new Error('e')))).toBe('reconcile');
      expect(classifyMutationFailure(new Error('boom'))).toBe('reconcile');
      expect(classifyMutationFailure('string-error')).toBe('reconcile');
    });
  });

  describe('addPreviewLedgerEntry / getOwnedPreview', () => {
    it('stores a draft entry with a computed content hash', async () => {
      const entry = await addPreviewLedgerEntry({
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

      const owned = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(owned.resourceKey).toBe('my-slug');
    });

    it('rejects lookups from another session', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's2', projectUuid: 'p1' }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('rejects lookups from another project', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p2' }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('expires entries after ttlMs', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
        ttlMs: -1,
      });
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_EXPIRED',
      );
    });

    it('rejects an unknown previewId', async () => {
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: 'missing', sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_REQUIRED',
      );
    });
  });

  describe('markPreviewValidated', () => {
    it('transitions a draft preview to validated when the expected resource matches', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
        proposed: { name: 'Dash' },
      });
      const validated = await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
      });
      expect(validated.status).toBe('validated');
    });

    it('rejects a mismatched resourceKind (bound validation)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
        proposed: { name: 'Dash' },
      });
      await expectPreviewErrorCode(
        () =>
          markPreviewValidated(entry.previewId, 's1', 'p1', {
            resourceKind: 'chart',
            resourceKey: 'dash-1',
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects a mismatched resourceKey (bound validation)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-1',
        proposed: { name: 'Chart' },
      });
      await expectPreviewErrorCode(
        () =>
          markPreviewValidated(entry.previewId, 's1', 'p1', {
            resourceKind: 'chart',
            resourceKey: 'chart-2',
          }),
        'PREVIEW_STALE',
      );
    });

    it('accepts an alias resourceKey (uuid ↔ slug)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Chart' },
      });
      const validated = await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'revenue-kpi',
      });
      expect(validated.status).toBe('validated');
    });
  });

  describe('claim / apply / release state machine', () => {
    async function validatedChart(proposed: unknown = { name: 'Foo' }) {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      return entry;
    }

    it('claims validated → applying without deleting', async () => {
      const entry = await validatedChart();
      const claimed = await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(claimed.status).toBe('applying');
      const stillThere = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(stillThere.status).toBe('applying');
    });

    it('rejects a second concurrent claim (CAS)', async () => {
      const entry = await validatedChart();
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () =>
          claimPreviewForApply({
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

    it('markPreviewApplied deletes after applying', async () => {
      const entry = await validatedChart();
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await markPreviewApplied(entry.previewId);
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_REQUIRED',
      );
    });

    it('releases applying → validated on known no-write 4xx', async () => {
      const entry = await validatedChart();
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await releaseOrReconcilePreview(entry.previewId, apiError(404));
      const owned = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(owned.status).toBe('validated');
      // can claim again after release
      const reclaimed = await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(reclaimed.status).toBe('applying');
    });

    it('moves applying → reconciliation_required on 5xx', async () => {
      const entry = await validatedChart();
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await releaseOrReconcilePreview(entry.previewId, apiError(503));
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_RECONCILIATION_REQUIRED',
      );
    });

    it('rejects claim on draft (not yet validated)', async () => {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () =>
          claimPreviewForApply({
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

    it('releaseOrReconcile is a no-op when status is not applying', async () => {
      const entry = await validatedChart();
      await releaseOrReconcilePreview(entry.previewId, apiError(500));
      const owned = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(owned.status).toBe('validated');
    });

    it('releaseOrReconcile reconciles on RateLimitError / NetworkError', async () => {
      const entry = await validatedChart();
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await releaseOrReconcilePreview(
        entry.previewId,
        new RateLimitError(429, { name: 'RateLimit', statusCode: 429 }, {}),
      );
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_RECONCILIATION_REQUIRED',
      );

      const entry2 = await validatedChart({ name: 'Bar' });
      await claimPreviewForApply({
        previewId: entry2.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Bar' },
      });
      await releaseOrReconcilePreview(
        entry2.previewId,
        new NetworkError('timeout', new Error('e')),
      );
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry2.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_RECONCILIATION_REQUIRED',
      );
    });
  });

  describe('fault-injection / multi-instance simulation', () => {
    async function validatedMove(proposed: {
      itemUuids: string[];
      targetSpaceUuid: string;
      contentTypes: string[];
    }) {
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: proposed.itemUuids.join(','),
        proposed,
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z', uuid: proposed.itemUuids[0] },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'content-move',
        resourceKey: proposed.itemUuids.join(','),
      });
      return entry;
    }

    it('double claim on the same previewId: second fails (CAS)', async () => {
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

      const claimInput = {
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart' as const,
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      };
      const results = await Promise.allSettled([
        claimPreviewForApply(claimInput),
        claimPreviewForApply(claimInput),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PreviewLedgerError);
      expect(((rejected[0] as PromiseRejectedResult).reason as PreviewLedgerError).code).toBe(
        'PREVIEW_NOT_VALIDATED',
      );
    });

    it('mutation failure after claim: release (retryable) or reconciliation_required', async () => {
      const proposed = { name: 'Retryable' };
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });

      // Known no-write → release to validated → can claim again
      await releaseOrReconcilePreview(entry.previewId, apiError(422));
      expect(
        (
          await getOwnedPreview({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
          })
        ).status,
      ).toBe('validated');

      await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      // Uncertain outcome → reconciliation_required (not retryable via claim)
      await releaseOrReconcilePreview(entry.previewId, apiError(500));
      await expectPreviewErrorCode(
        () =>
          claimPreviewForApply({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
            proposed,
          }),
        'PREVIEW_RECONCILIATION_REQUIRED',
      );
    });

    it('content-move baseline drift at claim → PREVIEW_STALE', async () => {
      const proposed = {
        itemUuids: ['item-a', 'item-b'],
        targetSpaceUuid: 'space-1',
        contentTypes: ['chart'],
      };
      const entry = await validatedMove(proposed);
      await expectPreviewErrorCode(
        () =>
          claimPreviewForApply({
            previewId: entry.previewId,
            sessionId: 's1',
            projectUuid: 'p1',
            resourceKind: 'content-move',
            resourceKey: 'item-a,item-b',
            proposed,
            currentBaseline: {
              updatedAt: '2026-08-02T12:00:00.000Z',
              uuid: 'item-a',
            },
          }),
        'PREVIEW_STALE',
      );
    });

    it('withClaimedPreviewApply does not release/reconcile when markApplied fails after success', async () => {
      class FaultyDeleteStore implements PreviewStore {
        private readonly inner = new InMemoryPreviewStore();

        get(previewId: string): Promise<PreviewLedgerEntry | undefined> {
          return this.inner.get(previewId);
        }

        put(entry: PreviewLedgerEntry): Promise<void> {
          return this.inner.put(entry);
        }

        compareAndSwap(
          previewId: string,
          expectedStatus: PreviewStatus,
          next: PreviewLedgerEntry,
        ): Promise<boolean> {
          return this.inner.compareAndSwap(previewId, expectedStatus, next);
        }

        compareAndDelete(_previewId: string, _expectedStatus: PreviewStatus): Promise<boolean> {
          return Promise.reject(new Error('compareAndDelete failed'));
        }

        delete(previewId: string): Promise<void> {
          return this.inner.delete(previewId);
        }
      }

      setPreviewStoreForTests(new FaultyDeleteStore());

      const proposed = { name: 'ApplyOk' };
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });

      const result = await withClaimedPreviewApply(
        {
          previewId: entry.previewId,
          sessionId: 's1',
          projectUuid: 'p1',
          resourceKind: 'chart',
          resourceKey: 'my-slug',
          proposed,
        },
        async () => ({ mutated: true }),
      );
      expect(result).toEqual({ mutated: true });

      // Entry must remain applying (not released to validated, not reconciliation_required).
      const after = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(after.status).toBe('applying');
    });

    it('shared InMemoryPreviewStore: preview/claim from facade A is visible to B', async () => {
      const shared = new InMemoryPreviewStore();
      // Facade A
      setPreviewStoreForTests(shared);
      const entry = await addPreviewLedgerEntry({
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-shared',
        proposed: { name: 'Shared' },
      });
      await markPreviewValidated(entry.previewId, 's1', 'p1', {
        resourceKind: 'dashboard',
        resourceKey: 'dash-shared',
      });

      // Facade B (same store, simulating a second logical instance)
      setPreviewStoreForTests(shared);
      const fromB = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(fromB.status).toBe('validated');
      expect(fromB.resourceKey).toBe('dash-shared');

      const claimedByB = await claimPreviewForApply({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-shared',
        proposed: { name: 'Shared' },
      });
      expect(claimedByB.status).toBe('applying');

      // Facade A observes B's claim
      setPreviewStoreForTests(shared);
      const fromA = await getOwnedPreview({
        previewId: entry.previewId,
        sessionId: 's1',
        projectUuid: 'p1',
      });
      expect(fromA.status).toBe('applying');

      await markPreviewApplied(entry.previewId);
      await expectPreviewErrorCode(
        () => getOwnedPreview({ previewId: entry.previewId, sessionId: 's1', projectUuid: 'p1' }),
        'PREVIEW_REQUIRED',
      );
    });
  });
});
