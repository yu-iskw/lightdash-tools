import { describe, expect, it } from 'vitest';

import { isApiSuccessEnvelope, unwrapApiSuccessResults } from './unwrap-api-success';

describe('unwrapApiSuccessResults', () => {
  it('returns results for ok envelopes', () => {
    expect(unwrapApiSuccessResults({ status: 'ok', results: { id: '1' } })).toEqual({ id: '1' });
  });

  it('throws for error envelopes', () => {
    expect(() =>
      unwrapApiSuccessResults({
        status: 'error',
        error: { statusCode: 400, message: 'bad request' },
      }),
    ).toThrow(/bad request/);
  });

  it('narrows success envelopes', () => {
    const body = { status: 'ok' as const, results: [1, 2] };
    expect(isApiSuccessEnvelope(body)).toBe(true);
  });
});
