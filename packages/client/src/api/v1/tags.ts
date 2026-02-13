/**
 * Tags API client.
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

export class TagsClient extends BaseApiClient {
  /** List tags in a project. */
  async listTags(projectUuid: string): Promise<LightdashApi.Tags.ApiGetTagsResponse> {
    return this.http.get<LightdashApi.Tags.ApiGetTagsResponse>(`/projects/${projectUuid}/tags`);
  }

  /** Get a tag by UUID. */
  async getTag(projectUuid: string, tagUuid: string): Promise<LightdashApi.Tags.ApiGetTagResponse> {
    return this.http.get<LightdashApi.Tags.ApiGetTagResponse>(
      `/projects/${projectUuid}/tags/${tagUuid}`,
    );
  }
}
