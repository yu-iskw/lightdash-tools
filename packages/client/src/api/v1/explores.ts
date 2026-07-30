/**
 * Explores API client (v1).
 */

import { BaseApiClient } from '../base-client';

import type { ApiExploresResults, ApiExploreResults, LightdashApi } from '@lightdash-tools/common';

type CompiledDimension = LightdashApi.Explores.CompiledTable['dimensions'][string];

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
  async listDimensions(projectUuid: string, exploreId: string): Promise<CompiledDimension[]> {
    const explore = await this.getExplore(projectUuid, exploreId);
    return Object.values(explore.tables).flatMap((table: LightdashApi.Explores.CompiledTable) =>
      Object.values(table.dimensions),
    );
  }

  /** Get lineage for a specific field in an explore. */
  async getFieldLineage(projectUuid: string, exploreId: string, fieldId: string): Promise<unknown> {
    const explore = await this.getExplore(projectUuid, exploreId);
    for (const table of Object.values(explore.tables) as LightdashApi.Explores.CompiledTable[]) {
      // Table maps are keyed by short field name; also accept `{table}_{name}` fieldIds.
      if (table.dimensions[fieldId] || table.metrics[fieldId]) {
        return table.lineageGraph;
      }
      const prefix = `${table.name}_`;
      if (fieldId.startsWith(prefix)) {
        const shortName = fieldId.slice(prefix.length);
        if (table.dimensions[shortName] || table.metrics[shortName]) {
          return table.lineageGraph;
        }
      }
    }
    return null;
  }
}
