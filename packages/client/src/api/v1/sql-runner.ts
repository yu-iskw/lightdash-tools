/**
 * SQL Runner API client. Endpoints for saved SQL charts (metadata + authored SQL body).
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

/** Saved SQL chart including authored `sql` body. */
export type SqlChart = components['schemas']['SqlChart'];

export class SqlRunnerClient extends BaseApiClient {
  /** Get a saved SQL chart by UUID within a project (includes authored SQL). */
  async getSavedSqlChart(projectUuid: string, uuid: string): Promise<SqlChart> {
    return this.http.get<SqlChart>(
      `/projects/${projectUuid}/sqlRunner/saved/${encodeURIComponent(uuid)}`,
    );
  }

  /** Get a saved SQL chart by slug within a project (includes authored SQL). */
  async getSavedSqlChartBySlug(projectUuid: string, slug: string): Promise<SqlChart> {
    return this.http.get<SqlChart>(
      `/projects/${projectUuid}/sqlRunner/saved/slug/${encodeURIComponent(slug)}`,
    );
  }
}
