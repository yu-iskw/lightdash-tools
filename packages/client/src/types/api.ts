/**
 * Helper types for Lightdash API. Re-exports generated OpenAPI types and adds response helpers.
 *
 * Note: Domain models (Project, Organization, etc.) are available from @lightdash-tools/common.
 * Use this module for advanced types (paths, components, operations) or response helpers.
 */

import type { components } from '@lightdash-tools/common';

export type { paths, components, operations } from '@lightdash-tools/common';

/** API error schema from OpenAPI. */
export type ApiError = components['schemas']['ApiErrorPayload'];

/** Successful API response wrapper (status ok + results). */
export interface ApiResponseOk<T> {
  status: 'ok';
  results: T;
}

/** Failed API response wrapper (status error + error). */
export interface ApiResponseError {
  status: 'error';
  error: ApiError['error'];
}

/** Discriminated union for API response body. */
export type ApiResponseBody<T> = ApiResponseOk<T> | ApiResponseError;
