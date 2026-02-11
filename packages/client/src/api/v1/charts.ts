/**
 * Charts API client. Endpoints for saved charts and chart-as-code operations.
 */

import type {
  SpaceQuery,
  ChartAsCodeListResults,
  ChartAsCodeUpsertResults,
  UpsertChartAsCodeBody,
} from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

export interface GetChartsAsCodeOptions {
  ids?: string[];
  offset?: number;
  languageMap?: boolean;
}

export class ChartsClient extends BaseApiClient {
  /** List charts in a project (returns SpaceQuery array). */
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
      `/projects/${projectUuid}/charts/code`,
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
      `/projects/${projectUuid}/charts/${encodeURIComponent(slug)}/code`,
      body,
    );
  }
}
