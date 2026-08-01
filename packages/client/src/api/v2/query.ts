/**
 * Query API client for v2 endpoints. Run metric/SQL/underlying data queries using v2 API.
 */

import { BaseApiClient } from '../base-client';

import type {
  ExecuteAsyncMetricQueryRequestParams,
  ExecuteAsyncSqlQueryRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncUnderlyingDataRequestParams,
  ExecuteAsyncMetricQueryResults,
  ExecuteAsyncDashboardChartResults,
  ExecuteAsyncSqlQueryResults,
  components,
} from '@lightdash-tools/common';

export type AsyncQueryResults = components['schemas']['ApiGetAsyncQueryResults'];
export type ExecuteAsyncSqlChartRequestParams =
  components['schemas']['ExecuteAsyncSqlChartRequestParams'];
export type ExecuteAsyncDashboardSqlChartRequestParams =
  components['schemas']['ExecuteAsyncDashboardSqlChartRequestParams'];

export type GetAsyncQueryResultsParams = {
  page?: number;
  pageSize?: number;
};

export class QueryClientV2 extends BaseApiClient {
  /** Run a metric query (v2 endpoint). */
  async runMetricQuery(
    projectUuid: string,
    body: ExecuteAsyncMetricQueryRequestParams,
  ): Promise<ExecuteAsyncMetricQueryResults> {
    return this.http.post<ExecuteAsyncMetricQueryResults>(
      `/projects/${projectUuid}/query/metric-query`,
      body,
    );
  }

  /** Run a SQL query (v2 endpoint). */
  async runSqlQuery(
    projectUuid: string,
    body: ExecuteAsyncSqlQueryRequestParams,
  ): Promise<ExecuteAsyncSqlQueryResults> {
    return this.http.post<ExecuteAsyncSqlQueryResults>(`/projects/${projectUuid}/query/sql`, body);
  }

  /** Run a chart query (v2 endpoint). */
  async runChartQuery(
    projectUuid: string,
    body: ExecuteAsyncSavedChartRequestParams,
  ): Promise<ExecuteAsyncMetricQueryResults> {
    return this.http.post<ExecuteAsyncMetricQueryResults>(
      `/projects/${projectUuid}/query/chart`,
      body,
    );
  }

  /** Run a dashboard chart query (v2 endpoint). */
  async runDashboardChartQuery(
    projectUuid: string,
    body: ExecuteAsyncDashboardChartRequestParams,
  ): Promise<ExecuteAsyncDashboardChartResults> {
    return this.http.post<ExecuteAsyncDashboardChartResults>(
      `/projects/${projectUuid}/query/dashboard-chart`,
      body,
    );
  }

  /** Run an underlying data query (v2 endpoint). */
  async runUnderlyingDataQuery(
    projectUuid: string,
    body: ExecuteAsyncUnderlyingDataRequestParams,
  ): Promise<ExecuteAsyncMetricQueryResults> {
    return this.http.post<ExecuteAsyncMetricQueryResults>(
      `/projects/${projectUuid}/query/underlying-data`,
      body,
    );
  }

  /** Run a saved SQL chart query (v2). Present for completeness; MCP content-reader keeps SQL off by default. */
  async runSqlChartQuery(
    projectUuid: string,
    body: ExecuteAsyncSqlChartRequestParams,
  ): Promise<ExecuteAsyncSqlQueryResults> {
    return this.http.post<ExecuteAsyncSqlQueryResults>(
      `/projects/${projectUuid}/query/sql-chart`,
      body,
    );
  }

  /** Run a dashboard SQL chart query (v2). Present for completeness; MCP content-reader keeps SQL off by default. */
  async runDashboardSqlChartQuery(
    projectUuid: string,
    body: ExecuteAsyncDashboardSqlChartRequestParams,
  ): Promise<ExecuteAsyncSqlQueryResults> {
    return this.http.post<ExecuteAsyncSqlQueryResults>(
      `/projects/${projectUuid}/query/dashboard-sql-chart`,
      body,
    );
  }

  /** Poll paginated async query results. */
  async getAsyncQueryResults(
    projectUuid: string,
    queryUuid: string,
    params?: GetAsyncQueryResultsParams,
  ): Promise<AsyncQueryResults> {
    return this.http.get<AsyncQueryResults>(
      `/projects/${projectUuid}/query/${encodeURIComponent(queryUuid)}`,
      { params },
    );
  }

  /** Cancel a running async query. */
  async cancelAsyncQuery(projectUuid: string, queryUuid: string): Promise<void> {
    await this.http.post<unknown>(
      `/projects/${projectUuid}/query/${encodeURIComponent(queryUuid)}/cancel`,
    );
  }
}
