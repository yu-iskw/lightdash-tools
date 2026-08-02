import { describe, expect, it } from 'vitest';

import {
  buildContentPrecondition,
  hashPreconditionMaterial,
  samePrecondition,
} from './precondition.js';

describe('hashPreconditionMaterial', () => {
  it('is stable for key order differences', () => {
    const a = hashPreconditionMaterial({ name: 'A', updatedAt: 't1', spaceUuid: 's1' });
    const b = hashPreconditionMaterial({ spaceUuid: 's1', updatedAt: 't1', name: 'A' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when material changes', () => {
    const a = hashPreconditionMaterial({ name: 'A', updatedAt: 't1' });
    const b = hashPreconditionMaterial({ name: 'A', updatedAt: 't2' });
    expect(a).not.toBe(b);
  });
});

describe('buildContentPrecondition', () => {
  it('binds identity fields and digests material metadata', () => {
    const pre = buildContentPrecondition({
      resourceType: 'dashboard',
      resourceId: 'd1',
      projectUuid: 'p1',
      name: 'Ops',
      updatedAt: '2026-08-01T12:00:00.000Z',
      spaceUuid: 'space-1',
    });
    expect(pre).toEqual({
      resourceType: 'dashboard',
      resourceId: 'd1',
      projectUuid: 'p1',
      digest: hashPreconditionMaterial({
        name: 'Ops',
        updatedAt: '2026-08-01T12:00:00.000Z',
        spaceUuid: 'space-1',
      }),
    });
  });

  it('treats missing spaceUuid as null in the digest', () => {
    const withMissing = buildContentPrecondition({
      resourceType: 'chart',
      resourceId: 'c1',
      projectUuid: 'p1',
      name: 'Chart',
      updatedAt: 't',
    });
    const withNull = buildContentPrecondition({
      resourceType: 'chart',
      resourceId: 'c1',
      projectUuid: 'p1',
      name: 'Chart',
      updatedAt: 't',
      spaceUuid: undefined,
    });
    expect(withMissing.digest).toBe(withNull.digest);
    expect(withMissing.digest).toBe(
      hashPreconditionMaterial({ name: 'Chart', updatedAt: 't', spaceUuid: null }),
    );
  });
});

describe('samePrecondition', () => {
  it('compares identity and digest', () => {
    const a = buildContentPrecondition({
      resourceType: 'chart',
      resourceId: 'c1',
      projectUuid: 'p1',
      name: 'N',
      updatedAt: 't',
    });
    expect(samePrecondition(a, { ...a })).toBe(true);
    expect(samePrecondition(a, { ...a, digest: 'other' })).toBe(false);
    expect(samePrecondition(a, { ...a, resourceId: 'c2' })).toBe(false);
  });
});
