/**
 * Dashboards API client. Endpoints for project dashboards and dashboard-as-code operations.
 */

import { BaseApiClient } from '../base-client';

import type {
  DashboardBasicDetailsWithTileTypes,
  DashboardAsCodeListResults,
  DashboardAsCodeUpsertResults,
  UpsertDashboardAsCodeBody,
} from '@lightdash-tools/common';

export interface GetDashboardsAsCodeOptions {
  ids?: string[];
  offset?: number;
  languageMap?: boolean;
}

export class DashboardsClient extends BaseApiClient {
  /** List dashboards in a project. */
  async listDashboards(projectUuid: string): Promise<DashboardBasicDetailsWithTileTypes[]> {
    return this.http.get<DashboardBasicDetailsWithTileTypes[]>(
      `/projects/${projectUuid}/dashboards`,
    );
  }

  /** Get dashboards in code representation (for dashboards-as-code workflows). */
  async getDashboardsAsCode(
    projectUuid: string,
    options?: GetDashboardsAsCodeOptions,
  ): Promise<DashboardAsCodeListResults> {
    const params: Record<string, unknown> = {};
    if (options?.ids?.length) params.ids = options.ids;
    if (options?.offset != null) params.offset = options.offset;
    if (options?.languageMap != null) params.languageMap = options.languageMap;
    return this.http.get<DashboardAsCodeListResults>(
      `/projects/${projectUuid}/code/dashboards`,
      Object.keys(params).length ? { params } : undefined,
    );
  }

  /** Upsert a dashboard from code representation (create or update by slug). */
  async upsertDashboardAsCode(
    projectUuid: string,
    slug: string,
    body: UpsertDashboardAsCodeBody,
  ): Promise<DashboardAsCodeUpsertResults> {
    return this.http.post<DashboardAsCodeUpsertResults>(
      `/projects/${projectUuid}/code/dashboards/${encodeURIComponent(slug)}`,
      body,
    );
  }
}
