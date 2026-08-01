/**
 * Charts API client (v2). Metadata reads only (no query execution).
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

export type SavedChart = components['schemas']['SavedChart'];

export class ChartsClientV2 extends BaseApiClient {
  /** Get saved chart metadata by UUID or slug within a project. Does not run queries. */
  async getSavedChart(projectUuid: string, chartUuidOrSlug: string): Promise<SavedChart> {
    return this.http.get<SavedChart>(
      `/projects/${projectUuid}/saved/${encodeURIComponent(chartUuidOrSlug)}`,
    );
  }
}
