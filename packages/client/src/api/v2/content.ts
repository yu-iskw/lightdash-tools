/**
 * Content API client (v2).
 */

import { BaseApiClient } from '../base-client';

import type { LightdashApi } from '@lightdash-tools/common';

/** Query params for searching content. */
export interface SearchContentParams {
  projectUuids?: string[];
  spaceUuids?: string[];
  parentSpaceUuid?: string;
  contentTypes?: ('chart' | 'dashboard' | 'space')[];
  pageSize?: number;
  page?: number;
  search?: string;
  sortBy?: LightdashApi.Content.ContentSortByColumns;
  sortDirection?: 'asc' | 'desc';
}

export class ContentClient extends BaseApiClient {
  /** Search project content (charts, dashboards, spaces). */
  async searchContent(
    params?: SearchContentParams,
  ): Promise<LightdashApi.Content.ApiContentResponse> {
    return this.http.get<LightdashApi.Content.ApiContentResponse>('/content', {
      params,
    });
  }
}
