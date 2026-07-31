/**
 * Dashboards API client (v2). Metadata reads only (no query execution).
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

export type Dashboard = components['schemas']['Dashboard'];

export class DashboardsClientV2 extends BaseApiClient {
  /** Get dashboard metadata by UUID or slug within a project. Does not run queries. */
  async getDashboard(projectUuid: string, dashboardUuidOrSlug: string): Promise<Dashboard> {
    return this.http.get<Dashboard>(
      `/projects/${projectUuid}/dashboards/${encodeURIComponent(dashboardUuidOrSlug)}`,
    );
  }
}
