/**
 * Helper types for Lightdash API. Re-exports generated OpenAPI types.
 *
 * Note: Domain models (Project, Organization, etc.) are available from @lightdash-tools/common.
 * Use this module for advanced types (paths, components, operations).
 * Response envelopes live in `http/unwrap-api-success` (re-exported from the package root).
 */

import type { components } from '@lightdash-tools/common';

export type { paths, components, operations } from '@lightdash-tools/common';

/** API error schema from OpenAPI. */
export type ApiError = components['schemas']['ApiErrorPayload'];
