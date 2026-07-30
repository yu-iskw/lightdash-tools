/**
 * Charts domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Charts {
  /** Space query (chart listing item). */
  export type SpaceQuery = components['schemas']['SpaceQuery'];

  /** Results of GET code/charts (list charts as code). */
  export type ChartAsCodeListResults =
    components['schemas']['ApiChartAsCodeListResponse']['results'];

  /** Results of POST code/charts/{slug} (upsert chart as code). */
  export type ChartAsCodeUpsertResults =
    components['schemas']['ApiChartAsCodeUpsertResponse']['results'];

  /** Request body for POST code/charts/{slug} (upsert chart as code). */
  export type UpsertChartAsCodeBody =
    components['schemas']['Omit_ChartAsCode.chartConfig-or-description_'] & {
      description?: string | null;
      chartConfig: components['schemas']['AnyType'];
      spaceNames?: components['schemas']['Record_string.string_'];
      force?: boolean;
      publicSpaceCreate?: boolean;
      skipSpaceCreate?: boolean;
    };
}
