/**
 * Validation API client (v2). Paginated validation results with search, filter, and sort support.
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

/** Query params for listing validation results (v2). */
export interface ListValidationResultsParams {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  sortBy?: 'createdAt' | 'errorType' | 'name' | 'source';
  sortDirection?: 'asc' | 'desc';
  sourceTypes?: string;
  errorTypes?: string;
  includeChartConfigWarnings?: boolean;
  fromSettings?: boolean;
}

export class ValidationClientV2 extends BaseApiClient {
  /**
   * List validation results for a project (v2 endpoint).
   * Returns paginated results with search, filter, and sort support.
   */
  async listValidationResults(
    projectUuid: string,
    params?: ListValidationResultsParams,
  ): Promise<components['schemas']['ApiPaginatedValidateResponse']> {
    return this.http.get<components['schemas']['ApiPaginatedValidateResponse']>(
      `/projects/${projectUuid}/validate`,
      { params },
    );
  }

  /**
   * Get a single validation result by ID (v2 endpoint).
   */
  async getValidationResult(
    projectUuid: string,
    validationId: number,
  ): Promise<components['schemas']['ApiSingleValidationResponse']> {
    return this.http.get<components['schemas']['ApiSingleValidationResponse']>(
      `/projects/${projectUuid}/validate/${validationId}`,
    );
  }
}
