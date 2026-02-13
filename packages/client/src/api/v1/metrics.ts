/**
 * Metrics API client.
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

/** Query params for listing metrics in catalog. */
export interface ListMetricsParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  categories?: string[];
  categoriesFilterMode?: 'any' | 'all';
  tables?: string[];
  ownerUserUuids?: string[];
}

export class MetricsClient extends BaseApiClient {
  /** List metrics in a project data catalog. */
  async listMetrics(
    projectUuid: string,
    params?: ListMetricsParams,
  ): Promise<LightdashApi.Metrics.ApiMetricsCatalog> {
    return this.http.get<LightdashApi.Metrics.ApiMetricsCatalog>(
      `/projects/${projectUuid}/dataCatalog/metrics`,
      { params },
    );
  }

  /** Get a metric by table and name. */
  async getMetric(
    projectUuid: string,
    tableName: string,
    metricName: string,
  ): Promise<LightdashApi.Metrics.ApiGetMetricResponse> {
    return this.http.get<LightdashApi.Metrics.ApiGetMetricResponse>(
      `/projects/${projectUuid}/dataCatalog/metrics/${tableName}/${metricName}`,
    );
  }
}
