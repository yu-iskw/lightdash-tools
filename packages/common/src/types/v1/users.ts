/**
 * Users (organization members) domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Users {
  /** Organization member profile. */
  export type OrganizationMemberProfile = components['schemas']['OrganizationMemberProfile'];
  /** Paginated list of organization member profiles (API response results). */
  export type OrganizationMemberProfilesResult =
    components['schemas']['KnexPaginatedData_OrganizationMemberProfile-Array_'];
  /** Single member profile API wrapper. */
  export type ApiOrganizationMemberProfile = components['schemas']['ApiOrganizationMemberProfile'];
  /** List member profiles API wrapper. */
  export type ApiOrganizationMemberProfiles =
    components['schemas']['ApiOrganizationMemberProfiles'];
  /** Update payload for organization member (e.g. role). */
  export type OrganizationMemberProfileUpdate =
    components['schemas']['OrganizationMemberProfileUpdate'];
}
