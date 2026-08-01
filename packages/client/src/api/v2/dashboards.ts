/**
 * Dashboards API client (v2). Metadata reads only (no query execution).
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

export type Dashboard = components['schemas']['Dashboard'];

/** Request body for PATCH projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}. */
export type UpdateDashboardBody = components['schemas']['UpdateDashboard'];

export class DashboardsClientV2 extends BaseApiClient {
  /** Get dashboard metadata by UUID or slug within a project. Does not run queries. */
  async getDashboard(projectUuid: string, dashboardUuidOrSlug: string): Promise<Dashboard> {
    return this.http.get<Dashboard>(
      `/projects/${projectUuid}/dashboards/${encodeURIComponent(dashboardUuidOrSlug)}`,
    );
  }

  /** Update a dashboard by UUID or slug within a project. */
  async updateDashboard(
    projectUuid: string,
    dashboardUuidOrSlug: string,
    body: UpdateDashboardBody,
  ): Promise<Dashboard> {
    return this.http.patch<Dashboard>(
      `/projects/${projectUuid}/dashboards/${encodeURIComponent(dashboardUuidOrSlug)}`,
      body,
    );
  }
}
