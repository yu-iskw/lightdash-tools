/**
 * Project parameters API client (v2). Read-only.
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

export type ProjectParametersListResults =
  components['schemas']['ApiGetProjectParametersListResults'];
export type ProjectParameterDefinitions = components['schemas']['ApiGetProjectParametersResults'];

export type ListProjectParametersParams = {
  search?: string;
  sortBy?: 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export class ParametersClientV2 extends BaseApiClient {
  /** List project parameter definitions (paginated). */
  async listParameters(
    projectUuid: string,
    params?: ListProjectParametersParams,
  ): Promise<ProjectParametersListResults> {
    return this.http.get<ProjectParametersListResults>(`/projects/${projectUuid}/parameters/list`, {
      params,
    });
  }

  /** Get project parameter definitions by name. */
  async getParameters(projectUuid: string, names?: string[]): Promise<ProjectParameterDefinitions> {
    return this.http.get<ProjectParameterDefinitions>(`/projects/${projectUuid}/parameters`, {
      params: names !== undefined ? { names } : undefined,
    });
  }
}
