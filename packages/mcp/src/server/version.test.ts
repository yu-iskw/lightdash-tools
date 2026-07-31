import { describe, expect, it } from 'vitest';

import { PACKAGE_VERSION } from './version.js';

describe('PACKAGE_VERSION', () => {
  it('matches semantic version pattern', () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
