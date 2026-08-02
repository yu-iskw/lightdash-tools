import { afterEach, describe, expect, it } from 'vitest';

import {
  claimConfirmationKey,
  confirmationClaimKey,
  releaseConfirmationKey,
  resetConfirmationClaimsForTests,
} from './confirmation-claim.js';

import type { DestructiveRequestState } from './types.js';

const state: DestructiveRequestState = {
  operationId: 'content-governance.dashboards.promote',
  resourceType: 'dashboard',
  resourceId: 'd1',
  projectUuid: 'p1',
  preconditionDigest: 'digest-a',
  sessionId: 's1',
  resourceName: 'Board',
};

describe('confirmation-claim', () => {
  afterEach(() => {
    resetConfirmationClaimsForTests();
  });

  it('allows the first claim and rejects a concurrent replay', async () => {
    const key = confirmationClaimKey(state);
    expect(await claimConfirmationKey(key)).toEqual(
      expect.objectContaining({ key, token: expect.any(String) }),
    );
    expect(await claimConfirmationKey(key)).toBeUndefined();
  });

  it('releases a claim so a confirmed no-write failure can retry', async () => {
    const key = confirmationClaimKey(state);
    const handle = await claimConfirmationKey(key);
    expect(handle).toBeDefined();
    await releaseConfirmationKey(handle!);
    expect(await claimConfirmationKey(key)).toEqual(
      expect.objectContaining({ key, token: expect.any(String) }),
    );
  });

  it('does not release when the handle token no longer owns the claim', async () => {
    const key = confirmationClaimKey(state);
    const first = await claimConfirmationKey(key);
    expect(first).toBeDefined();
    // Simulate TTL expiry + re-claim by a newer request.
    resetConfirmationClaimsForTests();
    const second = await claimConfirmationKey(key);
    expect(second).toBeDefined();
    await releaseConfirmationKey(first!);
    // Newer claim must still block a third acquire.
    expect(await claimConfirmationKey(key)).toBeUndefined();
    await releaseConfirmationKey(second!);
    expect(await claimConfirmationKey(key)).toBeDefined();
  });

  it('treats distinct precondition digests as distinct claims', async () => {
    const keyA = confirmationClaimKey(state);
    const keyB = confirmationClaimKey({ ...state, preconditionDigest: 'digest-b' });
    expect(await claimConfirmationKey(keyA)).toBeDefined();
    expect(await claimConfirmationKey(keyB)).toBeDefined();
  });
});
