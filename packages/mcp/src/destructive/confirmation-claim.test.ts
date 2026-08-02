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
    expect(await claimConfirmationKey(key)).toBe(true);
    expect(await claimConfirmationKey(key)).toBe(false);
  });

  it('releases a claim so a confirmed no-write failure can retry', async () => {
    const key = confirmationClaimKey(state);
    expect(await claimConfirmationKey(key)).toBe(true);
    await releaseConfirmationKey(key);
    expect(await claimConfirmationKey(key)).toBe(true);
  });

  it('treats distinct precondition digests as distinct claims', async () => {
    const keyA = confirmationClaimKey(state);
    const keyB = confirmationClaimKey({ ...state, preconditionDigest: 'digest-b' });
    expect(await claimConfirmationKey(keyA)).toBe(true);
    expect(await claimConfirmationKey(keyB)).toBe(true);
  });
});
