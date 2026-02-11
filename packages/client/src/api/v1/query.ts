/**
 * Query API client. Run metric/SQL/underlying data queries.
 */

import type {
  MetricQueryRequest,
  RunQueryResults,
  CompileQueryRequest,
  CompiledQueryResults,
} from '@lightdash-tools/common';
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

  /** Compile a metric query for an explore. */
  async compileQuery(
    projectUuid: string,
    exploreId: string,
    body: CompileQueryRequest,
  ): Promise<CompiledQueryResults> {
    return this.http.post<CompiledQueryResults>(
      `/projects/${projectUuid}/explores/${exploreId}/compileQuery`,
      body,
    );
  }
}
