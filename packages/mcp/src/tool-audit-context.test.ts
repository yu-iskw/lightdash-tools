import { describe, expect, it } from 'vitest';

import { getToolAuditAuth, runWithToolAuditAuthAsync } from './tool-audit-context.js';

describe('tool-audit-context', () => {
  it('exposes auth fields within the async scope', async () => {
    const seen: Array<{ tokenHash?: string; subject?: string } | undefined> = [];

    await runWithToolAuditAuthAsync({ tokenHash: 'hash-abc', subject: 'user-1' }, async () => {
      seen.push(getToolAuditAuth());
      await Promise.resolve();
      seen.push(getToolAuditAuth());
    });

    expect(seen).toEqual([
      { tokenHash: 'hash-abc', subject: 'user-1' },
      { tokenHash: 'hash-abc', subject: 'user-1' },
    ]);
    expect(getToolAuditAuth()).toBeUndefined();
  });
});
