/**
 * Dashboards domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Dashboards {
  /** Dashboard basic details with tile types. */
  export type DashboardBasicDetailsWithTileTypes =
    components['schemas']['DashboardBasicDetailsWithTileTypes'];

  /** Results of GET code/dashboards (list dashboards as code). */
  export type DashboardAsCodeListResults =
    components['schemas']['ApiDashboardAsCodeListResponse']['results'];

  /** Results of POST code/dashboards/{slug} (upsert dashboard as code). */
  export type DashboardAsCodeUpsertResults =
    components['schemas']['ApiDashboardAsCodeUpsertResponse']['results'];

  /** Request body for POST code/dashboards/{slug} (upsert dashboard as code). */
  export type UpsertDashboardAsCodeBody =
    components['schemas']['Omit_DashboardAsCode.tiles-or-description_'] & {
      description?: string | null;
      tiles: components['schemas']['AnyType'];
      spaceNames?: components['schemas']['Record_string.string_'];
      force?: boolean;
      publicSpaceCreate?: boolean;
      skipSpaceCreate?: boolean;
    };
}
