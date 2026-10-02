import { describe, expect, it } from 'vitest';

import { toAxiosConfig } from './request-options.js';

describe('toAxiosConfig', () => {
  it('returns undefined when options are omitted', () => {
    expect(toAxiosConfig()).toBeUndefined();
    expect(toAxiosConfig(undefined)).toBeUndefined();
  });

  it('maps timeout and request id and ignores retry', () => {
    expect(
      toAxiosConfig({
        timeoutMs: 180_000,
        requestId: 'req-1',
        retry: { maxRetries: 0 },
      }),
    ).toEqual({
      timeout: 180_000,
      headers: { 'X-Request-Id': 'req-1' },
    });
  });

  it('returns undefined when only retry is set', () => {
    expect(toAxiosConfig({ retry: { maxRetries: 0 } })).toBeUndefined();
  });
});
