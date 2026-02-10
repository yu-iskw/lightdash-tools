/**
 * Query API client. Run metric/SQL/underlying data queries.
 */

import type { MetricQueryRequest, RunQueryResults } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

export class QueryClient extends BaseApiClient {
  /** Run a metric query for an explore. */
  async runQuery(
    projectUuid: string,
    exploreId: string,
    body: MetricQueryRequest,
  ): Promise<RunQueryResults> {
    return this.http.post<RunQueryResults>(
      `/projects/${projectUuid}/explores/${exploreId}/runQuery`,
      body,
    );
  }
}
