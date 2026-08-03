/**
 * Map uncaught Lightdash client / runtime errors to stable MCP tool error codes.
 * Used by wrapTool catch — tool execution errors (isError), not JSON-RPC protocol errors.
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling
 */

import {
  ChartImageSizeError,
  CONTRACT_ERROR_NAME,
  LightdashApiError,
  NetworkError,
  RateLimitError,
} from '@lightdash-tools/client';

import { toMcpErrorMessage } from './errors.js';

/** Stable codes for uncaught upstream failures (not policy-blocked). */
export type UpstreamErrorCode =
  | 'IMAGE_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_CLIENT_ERROR'
  | 'UPSTREAM_CONTRACT'
  | 'UPSTREAM_FORBIDDEN'
  | 'UPSTREAM_NOT_FOUND'
  | 'UPSTREAM_TRANSIENT'
  | 'UPSTREAM_UNKNOWN'
  | 'UPSTREAM_UNSUPPORTED'
  | 'UPSTREAM_VALIDATION';

export type ClassifiedUpstreamError = {
  code: UpstreamErrorCode;
  message: string;
};

function classifyLightdashApiError(err: LightdashApiError): UpstreamErrorCode {
  if (err.error?.name === CONTRACT_ERROR_NAME) {
    return 'UPSTREAM_CONTRACT';
  }
  const status = err.statusCode;
  if (status === 429) {
    return 'RATE_LIMITED';
  }
  if (status === 501) {
    return 'UPSTREAM_UNSUPPORTED';
  }
  if (status === 408 || status >= 500) {
    return 'UPSTREAM_TRANSIENT';
  }
  if (status === 404) {
    return 'UPSTREAM_NOT_FOUND';
  }
  if (status === 403) {
    return 'UPSTREAM_FORBIDDEN';
  }
  if (status === 400 || status === 422) {
    return 'UPSTREAM_VALIDATION';
  }
  if (status >= 400 && status < 500) {
    return 'UPSTREAM_CLIENT_ERROR';
  }
  return 'UPSTREAM_UNKNOWN';
}

/**
 * Classify an unknown throw into `{ code, message }` for MCP tool error results.
 * Message text is sanitized via `toMcpErrorMessage` (no stacks/tokens).
 */
export function classifyUpstreamError(err: unknown): ClassifiedUpstreamError {
  const message = toMcpErrorMessage(err);

  if (err instanceof RateLimitError) {
    return { code: 'RATE_LIMITED', message };
  }
  if (err instanceof NetworkError) {
    return { code: 'UPSTREAM_TRANSIENT', message };
  }
  if (err instanceof ChartImageSizeError) {
    return { code: 'IMAGE_TOO_LARGE', message };
  }
  if (err instanceof LightdashApiError) {
    return { code: classifyLightdashApiError(err), message };
  }
  return { code: 'UPSTREAM_UNKNOWN', message };
}
