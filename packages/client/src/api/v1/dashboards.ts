/**
 * Dashboards API client. Endpoints for project dashboards and dashboard-as-code operations.
 */

import { BaseApiClient } from '../base-client';

import type {
  DashboardBasicDetailsWithTileTypes,
  DashboardAsCodeListResults,
  DashboardAsCodeUpsertResults,
  UpsertDashboardAsCodeBody,
  components,
} from '@lightdash-tools/common';

export interface GetDashboardsAsCodeOptions {
  ids?: string[];
  offset?: number;
  languageMap?: boolean;
}

/** Request body for POST projects/{projectUuid}/dashboards (create dashboard, or duplicate via query param). */
export type CreateDashboardBody =
  components['schemas']['CreateDashboard'] | components['schemas']['DuplicateDashboardParams'];

/** Options for createDashboard. */
export interface CreateDashboardOptions {
  /** UUID of an existing dashboard to duplicate from. When set, body should be DuplicateDashboardParams. */
  duplicateFrom?: string;
}

/** Result of POST projects/{projectUuid}/dashboards (create dashboard). */
export type CreateDashboardResult = components['schemas']['ApiCreateDashboardResponse']['results'];

/** Results of GET dashboards/{dashboardUuidOrSlug}/history (dashboard version history). */
export type DashboardHistoryResults =
  components['schemas']['ApiGetDashboardHistoryResponse']['results'];

/** Results of GET dashboards/{dashboardUuidOrSlug}/version/{versionUuid} (a single dashboard version). */
export type DashboardVersionResults =
  components['schemas']['ApiGetDashboardVersionResponse']['results'];

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

  /** Create a new dashboard in a project, or duplicate an existing one via `duplicateFrom`. */
  async createDashboard(
    projectUuid: string,
    body: CreateDashboardBody,
    options?: CreateDashboardOptions,
  ): Promise<CreateDashboardResult> {
    return this.http.post<CreateDashboardResult>(
      `/projects/${projectUuid}/dashboards`,
      body,
      options?.duplicateFrom ? { params: { duplicateFrom: options.duplicateFrom } } : undefined,
    );
  }

  /** Get dashboard version history from the last 30 days. */
  async getDashboardHistory(dashboardUuidOrSlug: string): Promise<DashboardHistoryResults> {
    return this.http.get<DashboardHistoryResults>(
      `/dashboards/${encodeURIComponent(dashboardUuidOrSlug)}/history`,
    );
  }

  /** Get a single dashboard version by UUID. */
  async getDashboardVersion(
    dashboardUuidOrSlug: string,
    versionUuid: string,
  ): Promise<DashboardVersionResults> {
    return this.http.get<DashboardVersionResults>(
      `/dashboards/${encodeURIComponent(dashboardUuidOrSlug)}/version/${versionUuid}`,
    );
  }
}
