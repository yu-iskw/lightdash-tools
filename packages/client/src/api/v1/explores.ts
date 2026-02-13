/**
 * Explores API client (v1).
 */

import type { ApiExploresResults, ApiExploreResults, LightdashApi } from '@lightdash-tools/common';
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

  /** List dimensions for a specific explore. */
  async listDimensions(projectUuid: string, exploreId: string): Promise<unknown[]> {
    const explore = await this.getExplore(projectUuid, exploreId);
    return Object.values(explore.tables).flatMap((table: LightdashApi.Explores.CompiledTable) =>
      Object.values(table.dimensions),
    );
  }

  /** Get lineage for a specific field in an explore. */
  async getFieldLineage(projectUuid: string, exploreId: string, fieldId: string): Promise<unknown> {
    const explore = await this.getExplore(projectUuid, exploreId);
    for (const table of Object.values(explore.tables) as LightdashApi.Explores.CompiledTable[]) {
      if (table.dimensions[fieldId] || table.metrics[fieldId]) {
        return table.lineageGraph;
      }
    }
    return null;
  }
}
