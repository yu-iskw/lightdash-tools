/**
 * Dashboards API client.
 */

import { BaseApiClient } from '../base-client';

import type { DashboardBasicDetailsWithTileTypes } from '@lightdash-tools/common';

export class DashboardsClient extends BaseApiClient {
  /** List dashboards in a project. */
  async listDashboards(projectUuid: string): Promise<DashboardBasicDetailsWithTileTypes[]> {
    return this.http.get<DashboardBasicDetailsWithTileTypes[]>(
      `/projects/${projectUuid}/dashboards`,
    );
  }
}
