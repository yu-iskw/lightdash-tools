/**
 * v1 rename API: field dropdowns, impact preview, and chart, dashboard-filter,
 * and project renames. The HTTP client unwraps `{ results }`.
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

type Schemas = components['schemas'];

type RenameFieldsResult = Schemas['ApiRenameFieldsResponse']['results'];
type RenamePreviewResult = Schemas['ApiRenameResponse']['results'];
type RenameChartResult = Schemas['ApiRenameChartResponse']['results'];
type RenameDashboardResult = Schemas['ApiRenameDashboardResponse']['results'];
type RenameResourcesResult = Schemas['ApiJobScheduledResponse']['results'];

/**
 * Client for Lightdash rename endpoints (the Validator "Fix" engine).
 * Does not reject `from === to` locally; the server returns ParameterError.
 */
export class RenameClient extends BaseApiClient {
  async listChartFields(projectUuid: string, chartUuid: string): Promise<RenameFieldsResult> {
    return this.http.get<RenameFieldsResult>(
      `/projects/${encodeURIComponent(projectUuid)}/rename/chart/${encodeURIComponent(chartUuid)}/fields`,
    );
  }

  async listDashboardFields(
    projectUuid: string,
    dashboardUuid: string,
    table?: string,
  ): Promise<RenameFieldsResult> {
    const path = `/projects/${encodeURIComponent(projectUuid)}/rename/dashboard/${encodeURIComponent(dashboardUuid)}/fields`;
    return this.http.get<RenameFieldsResult>(
      path,
      table === undefined ? undefined : { params: { table } },
    );
  }

  /** Project-wide impact list. Pass `dryRun: true` to avoid scheduling a job. */
  async previewRename(
    projectUuid: string,
    body: Schemas['ApiRenameBody'],
  ): Promise<RenamePreviewResult> {
    return this.http.post<RenamePreviewResult>(
      `/projects/${encodeURIComponent(projectUuid)}/rename/preview`,
      body,
    );
  }

  /**
   * Rewrite one chart. `jobId` is present only when the server scheduled a project job.
   * This client does not set `fixAll`.
   */
  async renameChart(
    projectUuid: string,
    chartUuid: string,
    body: Schemas['ApiRenameChartBody'],
  ): Promise<RenameChartResult> {
    return this.http.post<RenameChartResult>(
      `/projects/${encodeURIComponent(projectUuid)}/rename/chart/${encodeURIComponent(chartUuid)}`,
      body,
    );
  }

  async renameDashboardFilter(
    projectUuid: string,
    dashboardUuid: string,
    body: Schemas['ApiRenameDashboardBody'],
  ): Promise<RenameDashboardResult> {
    return this.http.post<RenameDashboardResult>(
      `/projects/${encodeURIComponent(projectUuid)}/rename/dashboard/${encodeURIComponent(dashboardUuid)}`,
      body,
    );
  }

  /** Schedule a project-wide rename. Returns the scheduler `jobId`. Does not poll. */
  async renameResources(
    projectUuid: string,
    body: Schemas['ApiRenameBody'],
  ): Promise<RenameResourcesResult> {
    return this.http.post<RenameResourcesResult>(
      `/projects/${encodeURIComponent(projectUuid)}/rename`,
      body,
    );
  }
}
