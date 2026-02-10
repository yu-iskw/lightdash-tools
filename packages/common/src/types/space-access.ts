/**
 * Space access domain models (space-level user and group sharing).
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from './generated/openapi-types';

export namespace SpaceAccess {
  /** Payload to grant a user access to a space. */
  export type AddSpaceUserAccess = components['schemas']['AddSpaceUserAccess'];
  /** Payload to grant a group access to a space. */
  export type AddSpaceGroupAccess = components['schemas']['AddSpaceGroupAccess'];
  /** Role for a member in a space. */
  export type SpaceMemberRole = components['schemas']['SpaceMemberRole'];
}
