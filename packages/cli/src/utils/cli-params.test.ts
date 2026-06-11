import { describe, expect, it } from 'vitest';

import { pickDefined } from './cli-params';

describe('pickDefined', () => {
  it('returns undefined when all values are null or undefined', () => {
    expect(pickDefined({ page: undefined, search: null })).toBeUndefined();
  });

  it('returns only defined entries', () => {
    expect(pickDefined({ page: 1, search: undefined, name: 'x' })).toEqual({ page: 1, name: 'x' });
  });
});
