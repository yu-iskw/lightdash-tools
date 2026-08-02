/**
 * Charts API client. Endpoints for saved charts and chart-as-code operations.
 */

import { BaseApiClient } from '../base-client';

import type {
  SpaceQuery,
  ChartAsCodeListResults,
  ChartAsCodeUpsertResults,
  UpsertChartAsCodeBody,
  components,
} from '@lightdash-tools/common';

export interface GetChartsAsCodeOptions {
  ids?: string[];
  offset?: number;
  languageMap?: boolean;
}

/** Results of GET saved/{chartUuid}/history (chart version history). */
export type ChartHistoryResults = components['schemas']['ApiGetChartHistoryResponse']['results'];

/** Results of GET saved/{chartUuid}/version/{versionUuid} (a single chart version). */
export type ChartVersionResults = components['schemas']['ApiGetChartVersionResponse']['results'];

export class ChartsClient extends BaseApiClient {
  /**
   * List charts in a project (returns SpaceQuery array).
   * @deprecated This API endpoint is deprecated in Lightdash. Use charts-as-code API instead.
   */
  async listCharts(projectUuid: string): Promise<SpaceQuery[]> {
    return this.http.get<SpaceQuery[]>(`/projects/${projectUuid}/charts`);
  }

  /** Get charts in code representation (for charts-as-code workflows). */
  async getChartsAsCode(
    projectUuid: string,
    options?: GetChartsAsCodeOptions,
  ): Promise<ChartAsCodeListResults> {
    const params: Record<string, unknown> = {};
    if (options?.ids?.length) params.ids = options.ids;
    if (options?.offset != null) params.offset = options.offset;
    if (options?.languageMap != null) params.languageMap = options.languageMap;
    return this.http.get<ChartAsCodeListResults>(
      `/projects/${projectUuid}/code/charts`,
      Object.keys(params).length ? { params } : undefined,
    );
  }

  /** Upsert a chart from code representation (create or update by slug). */
  async upsertChartAsCode(
    projectUuid: string,
    slug: string,
    body: UpsertChartAsCodeBody,
  ): Promise<ChartAsCodeUpsertResults> {
    return this.http.post<ChartAsCodeUpsertResults>(
      `/projects/${projectUuid}/code/charts/${encodeURIComponent(slug)}`,
      body,
    );
  }

  /** Get chart version history from the last 30 days. */
  async getChartHistory(chartUuid: string): Promise<ChartHistoryResults> {
    return this.http.get<ChartHistoryResults>(`/saved/${chartUuid}/history`);
  }

  /** Get a single chart version by UUID. */
  async getChartVersion(chartUuid: string, versionUuid: string): Promise<ChartVersionResults> {
    return this.http.get<ChartVersionResults>(`/saved/${chartUuid}/version/${versionUuid}`);
  }
}
