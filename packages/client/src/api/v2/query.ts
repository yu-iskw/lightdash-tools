/**
 * Query API client for v2 endpoints. Run metric/SQL/underlying data queries using v2 API.
 */

import type {
  ExecuteAsyncMetricQueryRequestParams,
  ExecuteAsyncSqlQueryRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncUnderlyingDataRequestParams,
  ExecuteAsyncMetricQueryResults,
  ExecuteAsyncDashboardChartResults,
  ExecuteAsyncSqlQueryResults,
} from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

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
}
