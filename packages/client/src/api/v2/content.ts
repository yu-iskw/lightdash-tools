/**
 * Content API client (v2).
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

/** Query params for searching content. */
export interface SearchContentParams {
  projectUuids?: string[];
  spaceUuids?: string[];
  parentSpaceUuid?: string;
  contentTypes?: ('chart' | 'dashboard' | 'space')[];
  pageSize?: number;
  page?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastViewedAt' | 'views';
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
