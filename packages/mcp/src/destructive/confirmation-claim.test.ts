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

  it('allows the first claim and rejects a concurrent replay', () => {
    const key = confirmationClaimKey(state);
    expect(claimConfirmationKey(key)).toBe(true);
    expect(claimConfirmationKey(key)).toBe(false);
  });

  it('releases a claim so a failed apply can retry', () => {
    const key = confirmationClaimKey(state);
    expect(claimConfirmationKey(key)).toBe(true);
    releaseConfirmationKey(key);
    expect(claimConfirmationKey(key)).toBe(true);
  });

  it('treats distinct precondition digests as distinct claims', () => {
    const keyA = confirmationClaimKey(state);
    const keyB = confirmationClaimKey({ ...state, preconditionDigest: 'digest-b' });
    expect(claimConfirmationKey(keyA)).toBe(true);
    expect(claimConfirmationKey(keyB)).toBe(true);
  });
});
