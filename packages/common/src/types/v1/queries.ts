/**
 * Queries domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from '../generated/openapi-types';

export namespace Queries {
  /**
   * Query request types.
   */
  export namespace Requests {
    /** V1 metric query request. */
    export type MetricQuery = components['schemas']['MetricQueryRequest'];
    /** V1 compile query request (MetricQuery with optional pivotConfiguration and parameters). */
    export type CompileQuery = components['schemas']['MetricQuery'] & {
      pivotConfiguration?: components['schemas']['PivotConfiguration'];
      parameters?: components['schemas']['ParametersValuesMap'];
    };
    /** V2 async metric query request parameters. */
    export type ExecuteAsyncMetricQuery =
      components['schemas']['ExecuteAsyncMetricQueryRequestParams'];
    /** V2 async SQL query request parameters. */
    export type ExecuteAsyncSqlQuery = components['schemas']['ExecuteAsyncSqlQueryRequestParams'];
    /** V2 async saved chart query request parameters. */
    export type ExecuteAsyncSavedChart =
      components['schemas']['ExecuteAsyncSavedChartRequestParams'];
    /** V2 async dashboard chart query request parameters. */
    export type ExecuteAsyncDashboardChart =
      components['schemas']['ExecuteAsyncDashboardChartRequestParams'];
    /** V2 async underlying data query request parameters. */
    export type ExecuteAsyncUnderlyingData =
      components['schemas']['ExecuteAsyncUnderlyingDataRequestParams'];
  }

  /**
   * Query response types.
   */
  export namespace Responses {
    /** V1 query response results. */
    export type RunQueryResults = components['schemas']['ApiRunQueryResponse']['results'];
    /** V1 compile query response results. */
    export type CompiledQueryResults = components['schemas']['ApiCompiledQueryResults'];
    /** V2 async metric query results. */
    export type ExecuteAsyncMetricQueryResults =
      components['schemas']['ApiExecuteAsyncMetricQueryResults'];
    /** V2 async dashboard chart query results. */
    export type ExecuteAsyncDashboardChartResults =
      components['schemas']['ApiExecuteAsyncDashboardChartQueryResults'];
    /** V2 async SQL query results. */
    export type ExecuteAsyncSqlQueryResults =
      components['schemas']['ApiExecuteAsyncSqlQueryResults'];
  }
}
