/**
 * Spaces domain models (core entity and CRUD payloads).
 * Space access types (AddSpaceUserAccess, AddSpaceGroupAccess, SpaceMemberRole) live in space-access.ts.
 */

import type { components } from './generated/openapi-types';

export namespace Spaces {
  /** Space summary. */
  export type SpaceSummary = components['schemas']['SpaceSummary'];
  /** Full space with children, access, dashboards, queries. */
  export type Space = components['schemas']['Space'];
  /** Payload to create a space. */
  export type CreateSpace = components['schemas']['CreateSpace'];
  /** Payload to update a space. */
  export type UpdateSpace = components['schemas']['UpdateSpace'];
}
