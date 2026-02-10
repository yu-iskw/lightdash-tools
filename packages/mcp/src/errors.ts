/**
 * Map Lightdash client errors to safe user-facing messages for MCP responses.
 * Never expose stack traces or tokens.
 */

import { LightdashApiError, RateLimitError, NetworkError } from '@lightdash-tools/client';

/**
 * Returns a short, safe message for MCP content from a client error.
 */
export function toMcpErrorMessage(err: unknown): string {
  if (err instanceof RateLimitError) {
    const after = err.retryAfter != null ? ` Retry after ${err.retryAfter}s.` : '';
    return `Rate limited (${err.statusCode}).${after}`;
  }
  if (err instanceof LightdashApiError) {
    const msg = err.error?.message ?? `HTTP ${err.statusCode}`;
    return `Lightdash API error: ${msg}`;
  }
  if (err instanceof NetworkError) {
    return `Network error: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message || 'Unknown error';
  }
  return String(err);
}
