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
  GetAsyncQueryResults,
} from '@lightdash-tools/common';

/** Query params for getAsyncQueryResults. Page starts at 1; pageSize defaults to 500, max 5000 (Lightdash-side). */
export interface GetAsyncQueryResultsParams {
  page?: number;
  pageSize?: number;
}

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

  /**
   * Get a page of results for a previously-started async query (v2 endpoint).
   * Returns a status-discriminated union: poll while pending/queued/executing,
   * fail on error/expired/cancelled, paginate while ready.
   */
  async getAsyncQueryResults(
    projectUuid: string,
    queryUuid: string,
    params?: GetAsyncQueryResultsParams,
  ): Promise<GetAsyncQueryResults> {
    return this.http.get<GetAsyncQueryResults>(`/projects/${projectUuid}/query/${queryUuid}`, {
      params,
    });
  }

  /** Cancel a running async query and discard any partial results (v2 endpoint). */
  async cancelAsyncQuery(projectUuid: string, queryUuid: string): Promise<void> {
    await this.http.post<void>(`/projects/${projectUuid}/query/${queryUuid}/cancel`);
  }
}
