import { beforeEach, describe, expect, it } from 'vitest';

import {
  PreviewLedgerError,
  confirmPreviewToken,
  hashPreviewContent,
  mintDraftPreviewToken,
  resetPreviewLedgerForTests,
  withValidatedPreviewApply,
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

  describe('mintDraftPreviewToken + confirmPreviewToken', () => {
    it('mints a draft token with correct claims', async () => {
      const { previewToken, claims } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      expect(typeof previewToken).toBe('string');
      expect(previewToken.length).toBeGreaterThan(0);
      expect(claims.status).toBe('draft');
      expect(claims.subject).toBe('s1');
      expect(claims.projectUuid).toBe('p1');
      expect(claims.resourceKey).toBe('my-slug');
      expect(claims.resourceAliases).toContain('my-slug');
    });

    it('confirms a draft token → validated', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      const { claims } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      expect(claims.status).toBe('validated');
      expect(claims.subject).toBe('s1');
    });

    it('rejects confirmation from a different subject → PREVIEW_NOT_OWNED', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'a,b',
        proposed: { itemUuids: ['a', 'b'], targetSpaceUuid: 's1' },
      });
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken,
            subject: 's2',
            projectUuid: 'p1',
            resourceKind: 'content-move',
            resourceKey: 'a,b',
          }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('rejects confirmation with mismatched resourceKind → PREVIEW_STALE', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'dashboard',
        resourceKey: 'dash-1',
        proposed: { name: 'Dash' },
      });
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken,
            subject: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'dash-1',
          }),
        'PREVIEW_STALE',
      );
    });

    it('rejects confirmation with mismatched resourceKey → PREVIEW_STALE', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-1',
        proposed: { name: 'Chart' },
      });
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken,
            subject: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'chart-2',
          }),
        'PREVIEW_STALE',
      );
    });

    it('accepts an alias resourceKey for confirmation (uuid ↔ slug)', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed: { name: 'Chart' },
      });
      const { claims } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'revenue-kpi',
      });
      expect(claims.status).toBe('validated');
    });
  });

  describe('withValidatedPreviewApply', () => {
    it('runs the mutation when hash and subject match', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      const result = await withValidatedPreviewApply(
        {
          previewToken: validated,
          subject: 's1',
          projectUuid: 'p1',
          resourceKind: 'chart',
          resourceKey: 'my-slug',
          proposed,
        },
        async () => ({ ok: true }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('rejects a draft (not yet confirmed) preview at apply → PREVIEW_NOT_VALIDATED', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'my-slug',
              proposed,
            },
            async () => {},
          ),
        'PREVIEW_NOT_VALIDATED',
      );
    });

    it('rejects a mismatched resourceKey at apply → PREVIEW_STALE', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'other-slug',
              proposed,
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('rejects a drifted payload (content hash mismatch) → PREVIEW_STALE', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'my-slug',
              proposed: { name: 'Changed after preview' },
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('rejects apply from a different subject → PREVIEW_NOT_OWNED', async () => {
      const proposed = { itemUuids: ['a', 'b'], targetSpaceUuid: 's1' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'a,b',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'a,b',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's2',
              projectUuid: 'p1',
              resourceKind: 'content-move',
              resourceKey: 'a,b',
              proposed,
            },
            async () => {},
          ),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('applies by alias resourceKey when uuid was stored as primary', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      const result = await withValidatedPreviewApply(
        {
          previewToken: validated,
          subject: 's1',
          projectUuid: 'p1',
          resourceKind: 'chart',
          resourceKey: 'revenue-kpi',
          proposed,
        },
        async (claims) => claims.resourceKey,
      );
      expect(result).toBe('chart-uuid-1');
    });

    it('rejects when baseline updatedAt drifted at apply time → PREVIEW_STALE', async () => {
      const proposed = { name: 'Foo' };
      const baseline = { updatedAt: '2026-08-01T00:00:00.000Z', uuid: 'chart-uuid-1' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        resourceAliases: ['chart-uuid-1', 'revenue-kpi'],
        proposed,
        baseline,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'revenue-kpi',
              proposed,
              currentBaseline: { updatedAt: '2026-08-02T00:00:00.000Z', uuid: 'chart-uuid-1' },
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('rejects when baseline was captured but currentBaseline is missing at apply → PREVIEW_STALE', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
        proposed,
        baseline: { updatedAt: '2026-08-01T00:00:00.000Z' },
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'chart-uuid-1',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'chart-uuid-1',
              proposed,
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('rejects create previews when a resource appears before apply → PREVIEW_STALE', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'new-slug',
              proposed,
              currentBaseline: { uuid: 'appeared-after-preview', slug: 'new-slug' },
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('allows create previews when the target is still absent at apply', async () => {
      const proposed = { name: 'Foo' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
        proposed,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'new-slug',
      });
      const claims = await withValidatedPreviewApply(
        {
          previewToken: validated,
          subject: 's1',
          projectUuid: 'p1',
          resourceKind: 'chart',
          resourceKey: 'new-slug',
          proposed,
        },
        async (c) => c,
      );
      expect(claims.resourceKey).toBe('new-slug');
    });
  });
});
