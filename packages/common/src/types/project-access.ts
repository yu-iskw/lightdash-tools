/**
 * Project access domain models (project-level user and group access).
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from './generated/openapi-types';

export namespace ProjectAccess {
  /** Profile of a project member. */
  export type ProjectMemberProfile = components['schemas']['ProjectMemberProfile'];
  /** Role for a project member. */
  export type ProjectMemberRole = components['schemas']['ProjectMemberRole'];
  /** Payload to grant a user access to a project. */
  export type CreateProjectMember = components['schemas']['CreateProjectMember'];
  /** Payload to update a project member's role. */
  export type UpdateProjectMember = components['schemas']['UpdateProjectMember'];
  /** Group access to a project. */
  export type ProjectGroupAccess = components['schemas']['ProjectGroupAccess'];
  /** Payload to add a group to a project. */
  export type CreateProjectGroupAccessBody =
    components['schemas']['Pick_CreateProjectGroupAccess.role_'];
  /** Payload to update a group's project access. */
  export type UpdateProjectGroupAccess = components['schemas']['UpdateDBProjectGroupAccess'];
}
