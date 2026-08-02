/**
 * Content API client (v2).
 */

import { BaseApiClient } from '../base-client';

import type { components, LightdashApi } from '@lightdash-tools/common';

/** Query params for searching content. */
export interface SearchContentParams {
  projectUuids?: string[];
  spaceUuids?: string[];
  parentSpaceUuid?: string;
  contentTypes?: ('chart' | 'dashboard' | 'data_app' | 'space')[];
  pageSize?: number;
  page?: number;
  search?: string;
  sortBy?: LightdashApi.Content.ContentSortByColumns;
  sortDirection?: 'asc' | 'desc';
}

/** Body for moving a single content item (chart, dashboard, or space) to another space. */
export type MoveContentBody = components['schemas']['ApiContentActionBody_ContentActionMove_'];

/** Body for moving multiple content items (charts, dashboards, spaces) to another space. */
export type BulkMoveContentBody =
  components['schemas']['ApiContentBulkActionBody_ContentActionMove_'];

/** Body for permanently deleting soft-deleted content (irrecoverable). */
export type PermanentlyDeleteContentBody = components['schemas']['ApiPermanentlyDeleteContentBody'];

export class ContentClient extends BaseApiClient {
  /** Search project content (charts, dashboards, spaces). */
  async searchContent(
    params?: SearchContentParams,
  ): Promise<LightdashApi.Content.ApiContentResponse> {
    return this.http.get<LightdashApi.Content.ApiContentResponse>('/content', {
      params,
    });
  }

  /** Move a single content item (chart, dashboard, or space) to another space. */
  async moveContent(projectUuid: string, body: MoveContentBody): Promise<void> {
    await this.http.post(`/content/${projectUuid}/move`, body);
  }

  /** Move multiple content items (charts, dashboards, spaces) to another space in one call. */
  async bulkMoveContent(projectUuid: string, body: BulkMoveContentBody): Promise<void> {
    await this.http.post(`/content/bulk-action/${projectUuid}/move`, body);
  }

  /**
   * Permanently delete soft-deleted content (irrecoverable).
   * Not exposed on MCP — use typed client only (ADR-0015).
   */
  async permanentlyDeleteContent(
    projectUuid: string,
    body: PermanentlyDeleteContentBody,
  ): Promise<void> {
    await this.http.delete(`/content/${projectUuid}/permanent`, { data: body });
  }
}
