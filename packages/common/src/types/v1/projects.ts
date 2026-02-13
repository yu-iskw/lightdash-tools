/**
 * Projects domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Projects {
  /** Project entity. */
  export type Project = components['schemas']['Project'];
  /** Organization project listing item. */
  export type OrganizationProject = components['schemas']['OrganizationProject'];
}
