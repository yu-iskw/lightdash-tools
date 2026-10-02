/**
 * Charts API client. Endpoints for saved charts and chart-as-code operations.
 */

import { BinarySizeLimitError, ChartImageSizeError } from '../../errors';
import { DEFAULT_BINARY_MAX_BYTES } from '../../http/http-client';
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

/** Headless chart PNG export can take longer than the default HTTP timeout. */
export const CHART_IMAGE_EXPORT_TIMEOUT_MS = 120_000;

/** Hard cap on downloaded PNG size (8 MiB). */
export const CHART_IMAGE_MAX_BYTES = DEFAULT_BINARY_MAX_BYTES;

export type ChartImagePng = {
  imageUrl: string;
  bytes: Buffer;
  mimeType: string;
};

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

  /**
   * Export a saved chart as a PNG via headless render.
   * @returns Image URL string from `ApiExportChartImageResponse.results`.
   */
  async exportChartImage(chartUuid: string, projectUuid?: string): Promise<string> {
    return this.http.post<string>(`/saved/${encodeURIComponent(chartUuid)}/export`, undefined, {
      params: projectUuid ? { projectUuid } : undefined,
      timeout: CHART_IMAGE_EXPORT_TIMEOUT_MS,
    });
  }

  /**
   * Export a saved chart PNG and download the image bytes.
   * Requires Lightdash headless browser support on the instance.
   */
  async exportChartImagePng(chartUuid: string, projectUuid?: string): Promise<ChartImagePng> {
    const imageUrl = await this.exportChartImage(chartUuid, projectUuid);
    let bytes: Buffer;
    let mimeType: string;
    try {
      ({ bytes, mimeType } = await this.http.getBytes(imageUrl, {
        maxBytes: CHART_IMAGE_MAX_BYTES,
        timeout: CHART_IMAGE_EXPORT_TIMEOUT_MS,
      }));
    } catch (err) {
      if (err instanceof BinarySizeLimitError) {
        throw new ChartImageSizeError(err.maxBytes, err.byteLength);
      }
      throw err;
    }
    return {
      imageUrl,
      bytes,
      mimeType: mimeType === 'application/octet-stream' ? 'image/png' : mimeType,
    };
  }
}
