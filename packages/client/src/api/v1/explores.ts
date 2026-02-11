/**
 * Explores API client (v1).
 */

import type { ApiExploresResults, ApiExploreResults } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

export class ExploresClient extends BaseApiClient {
  /** List all explores for a project. */
  async listExplores(projectUuid: string): Promise<ApiExploresResults> {
    return this.http.get<ApiExploresResults>(`/projects/${projectUuid}/explores`);
  }

  /** Get a specific explore by ID. */
  async getExplore(projectUuid: string, exploreId: string): Promise<ApiExploreResults> {
    return this.http.get<ApiExploreResults>(`/projects/${projectUuid}/explores/${exploreId}`);
  }
}
