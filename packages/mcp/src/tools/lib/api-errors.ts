/**
 * Narrow Lightdash API error checks for org-audit primitives.
 */

import { LightdashApiError } from '@lightdash-tools/client';

/** Forbidden/not-found — often expected when access is partial. */
export function isForbiddenOrNotFound(err: unknown): boolean {
  return err instanceof LightdashApiError && (err.statusCode === 403 || err.statusCode === 404);
}

/** Map 403/404 to AuditCoverage inaccessible reason. */
export function visibilityFailureReason(err: unknown): 'forbidden' | 'not_found' {
  return err instanceof LightdashApiError && err.statusCode === 404 ? 'not_found' : 'forbidden';
}

/** Capability unavailable on this instance (or forbidden/missing). */
export function isUnsupportedCapabilityError(err: unknown): boolean {
  return (
    err instanceof LightdashApiError &&
    (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 501)
  );
}
