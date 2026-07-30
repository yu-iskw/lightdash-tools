import { describe, expect, it } from 'vitest';

import { registerToolsByIds } from './tools';

describe('tools barrel', () => {
  it('exports registerToolsByIds', () => {
    expect(typeof registerToolsByIds).toBe('function');
  });
});
