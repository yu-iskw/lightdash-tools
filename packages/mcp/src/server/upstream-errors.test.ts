import {
  ChartImageSizeError,
  CONTRACT_ERROR_NAME,
  LightdashApiError,
  NetworkError,
  RateLimitError,
} from '@lightdash-tools/client';
import { describe, expect, it } from 'vitest';

import { classifyUpstreamError } from './upstream-errors.js';

const emptyRequest = {};

function apiError(statusCode: number, message: string, name = 'ApiError'): LightdashApiError {
  return new LightdashApiError(statusCode, { name, statusCode, message }, emptyRequest);
}

describe('classifyUpstreamError', () => {
  it('maps 404 to UPSTREAM_NOT_FOUND', () => {
    const result = classifyUpstreamError(apiError(404, 'missing'));
    expect(result.code).toBe('UPSTREAM_NOT_FOUND');
    expect(result.message).toContain('missing');
  });

  it('maps 400 and 422 to UPSTREAM_VALIDATION', () => {
    expect(classifyUpstreamError(apiError(400, 'bad')).code).toBe('UPSTREAM_VALIDATION');
    expect(classifyUpstreamError(apiError(422, 'invalid')).code).toBe('UPSTREAM_VALIDATION');
  });

  it('maps 503 and 408 to UPSTREAM_TRANSIENT', () => {
    expect(classifyUpstreamError(apiError(503, 'down')).code).toBe('UPSTREAM_TRANSIENT');
    expect(classifyUpstreamError(apiError(408, 'timeout')).code).toBe('UPSTREAM_TRANSIENT');
  });

  it('maps NetworkError to UPSTREAM_TRANSIENT', () => {
    const result = classifyUpstreamError(new NetworkError('ECONNRESET', new Error('reset')));
    expect(result.code).toBe('UPSTREAM_TRANSIENT');
    expect(result.message).toContain('ECONNRESET');
  });

  it('maps RateLimitError and 429 to RATE_LIMITED', () => {
    const limited = new RateLimitError(
      429,
      { name: 'RateLimit', statusCode: 429, message: 'slow down' },
      emptyRequest,
      undefined,
      30,
    );
    expect(classifyUpstreamError(limited).code).toBe('RATE_LIMITED');
    expect(classifyUpstreamError(apiError(429, 'too many')).code).toBe('RATE_LIMITED');
  });

  it('maps 403 / 501 / other 4xx', () => {
    expect(classifyUpstreamError(apiError(403, 'no')).code).toBe('UPSTREAM_FORBIDDEN');
    expect(classifyUpstreamError(apiError(501, 'nope')).code).toBe('UPSTREAM_UNSUPPORTED');
    expect(classifyUpstreamError(apiError(409, 'conflict')).code).toBe('UPSTREAM_CLIENT_ERROR');
  });

  it('maps ContractError name to UPSTREAM_CONTRACT', () => {
    const result = classifyUpstreamError(
      apiError(502, 'Unexpected Lightdash API response shape', CONTRACT_ERROR_NAME),
    );
    expect(result.code).toBe('UPSTREAM_CONTRACT');
  });

  it('maps ChartImageSizeError to IMAGE_TOO_LARGE', () => {
    expect(classifyUpstreamError(new ChartImageSizeError(50, 100)).code).toBe('IMAGE_TOO_LARGE');
  });

  it('maps unknown throws to UPSTREAM_UNKNOWN', () => {
    expect(classifyUpstreamError(new Error('boom')).code).toBe('UPSTREAM_UNKNOWN');
    expect(classifyUpstreamError('string-fail').code).toBe('UPSTREAM_UNKNOWN');
  });
});
