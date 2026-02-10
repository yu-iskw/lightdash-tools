/**
 * Dashboards API client.
 */

import type { DashboardBasicDetailsWithTileTypes } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

export class DashboardsClient extends BaseApiClient {
  /** List dashboards in a project. */
  async listDashboards(projectUuid: string): Promise<DashboardBasicDetailsWithTileTypes[]> {
    return this.http.get<DashboardBasicDetailsWithTileTypes[]>(
      `/projects/${projectUuid}/dashboards`,
    );
  }
}
