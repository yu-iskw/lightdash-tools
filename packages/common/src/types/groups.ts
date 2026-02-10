/**
 * Groups domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from './generated/openapi-types';

export namespace Groups {
  /** Group entity. */
  export type Group = components['schemas']['Group'];
  /** Group with members. */
  export type GroupWithMembers = components['schemas']['GroupWithMembers'];
  /** Payload to create a group. */
  export type CreateGroup = components['schemas']['CreateGroup'];
  /** Payload to update a group (name and/or members). */
  export type UpdateGroupWithMembers = components['schemas']['UpdateGroupWithMembers'];
  /** Paginated list of groups (API response results). */
  export type GroupListResult =
    components['schemas']['KnexPaginatedData_Group-Array-or-GroupWithMembers-Array_'];
  /** Single group API response. */
  export type ApiGroupResponse = components['schemas']['ApiGroupResponse'];
  /** List groups API response. */
  export type ApiGroupListResponse = components['schemas']['ApiGroupListResponse'];
  /** Create group API response. */
  export type ApiCreateGroupResponse = components['schemas']['ApiCreateGroupResponse'];
  /** Group members API response. */
  export type ApiGroupMembersResponse = components['schemas']['ApiGroupMembersResponse'];
  /** Group member (user reference in a group). */
  export type GroupMember = components['schemas']['GroupMember'];
}
