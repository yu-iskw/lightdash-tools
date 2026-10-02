import { beforeEach, describe, expect, it } from 'vitest';

import {
  PreviewLedgerError,
  confirmPreviewToken,
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

describe('preview-ledger faults and token binding', () => {
  beforeEach(() => {
    resetPreviewLedgerForTests();
  });

  describe('token validation faults', () => {
    it('rejects invalid / tampered previewToken at confirm → PREVIEW_REQUIRED', async () => {
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken: 'not-a-valid-token',
            subject: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
          }),
        'PREVIEW_REQUIRED',
      );
    });

    it('rejects empty previewToken at confirm → PREVIEW_REQUIRED', async () => {
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken: '',
            subject: 's1',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
          }),
        'PREVIEW_REQUIRED',
      );
    });

    it('rejects wrong subject at confirm → PREVIEW_NOT_OWNED', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken,
            subject: 's2',
            projectUuid: 'p1',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
          }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('rejects wrong project at confirm → PREVIEW_NOT_OWNED', async () => {
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart',
        resourceKey: 'my-slug',
        proposed: { name: 'Foo' },
      });
      await expectPreviewErrorCode(
        () =>
          confirmPreviewToken({
            previewToken,
            subject: 's1',
            projectUuid: 'p2',
            resourceKind: 'chart',
            resourceKey: 'my-slug',
          }),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('rejects wrong subject at apply → PREVIEW_NOT_OWNED', async () => {
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
              subject: 's2',
              projectUuid: 'p1',
              resourceKind: 'chart',
              resourceKey: 'my-slug',
              proposed,
            },
            async () => {},
          ),
        'PREVIEW_NOT_OWNED',
      );
    });

    it('hash mismatch at apply → PREVIEW_STALE', async () => {
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
              proposed: { name: 'Mutated after preview' },
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('content-move baseline drift at apply → PREVIEW_STALE', async () => {
      const proposed = {
        itemUuids: ['item-a', 'item-b'],
        targetSpaceUuid: 'space-1',
        contentTypes: ['chart'],
      };
      const baseline = { updatedAt: '2026-08-01T00:00:00.000Z', uuid: 'item-a' };
      const { previewToken } = await mintDraftPreviewToken({
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'item-a,item-b',
        proposed,
        baseline,
      });
      const { previewToken: validated } = await confirmPreviewToken({
        previewToken,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'content-move',
        resourceKey: 'item-a,item-b',
      });
      await expectPreviewErrorCode(
        () =>
          withValidatedPreviewApply(
            {
              previewToken: validated,
              subject: 's1',
              projectUuid: 'p1',
              resourceKind: 'content-move',
              resourceKey: 'item-a,item-b',
              proposed,
              currentBaseline: {
                updatedAt: '2026-08-02T12:00:00.000Z',
                uuid: 'item-a',
              },
            },
            async () => {},
          ),
        'PREVIEW_STALE',
      );
    });

    it('validated token can be applied multiple times (no server-side single-use)', async () => {
      // HMAC tokens are client-carried and stateless; single-use policy is enforced upstream.
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
      const applyInput = {
        previewToken: validated,
        subject: 's1',
        projectUuid: 'p1',
        resourceKind: 'chart' as const,
        resourceKey: 'my-slug',
        proposed,
      };
      await expect(withValidatedPreviewApply(applyInput, async () => 1)).resolves.toBe(1);
      await expect(withValidatedPreviewApply(applyInput, async () => 2)).resolves.toBe(2);
    });

    it('applying a draft (non-confirmed) token → PREVIEW_NOT_VALIDATED', async () => {
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
  });
});
