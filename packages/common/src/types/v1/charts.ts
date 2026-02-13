/**
 * Charts domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Charts {
  /** Space query (chart listing item). */
  export type SpaceQuery = components['schemas']['SpaceQuery'];

  /** Results of GET charts/code (list charts as code). */
  export type ChartAsCodeListResults =
    components['schemas']['ApiChartAsCodeListResponse']['results'];

  /** Results of POST charts/{slug}/code (upsert chart as code). */
  export type ChartAsCodeUpsertResults =
    components['schemas']['ApiChartAsCodeUpsertResponse']['results'];

  /** Request body for POST charts/{slug}/code (upsert chart as code). */
  export type UpsertChartAsCodeBody =
    components['schemas']['Omit_ChartAsCode.chartConfig-or-description_'] & {
      description?: string | null;
      chartConfig: components['schemas']['AnyType'];
      publicSpaceCreate?: boolean;
      skipSpaceCreate?: boolean;
    };
}
