/**
 * Validation API client.
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

/** Query params for getting validation results. */
export interface GetValidationResultsParams {
  fromSettings?: boolean;
  jobId?: string;
}

/** Body for triggering project validation. */
export interface ValidateProjectBody {
  validationTargets?: LightdashApi.Validation.ValidationTarget[];
  explores?: unknown[];
  onlyValidateExploresInArgs?: boolean;
}

export class ValidationClient extends BaseApiClient {
  /** Get validation results for a project. */
  async getValidationResults(
    projectUuid: string,
    params?: GetValidationResultsParams,
  ): Promise<LightdashApi.Validation.ApiValidateResponse> {
    return this.http.get<LightdashApi.Validation.ApiValidateResponse>(
      `/projects/${projectUuid}/validate`,
      { params },
    );
  }

  /** Validate content inside a project. Starts a validation job and returns the job ID. */
  async validateProject(
    projectUuid: string,
    body?: ValidateProjectBody,
  ): Promise<LightdashApi.Validation.ApiJobScheduledResponse> {
    return this.http.post<LightdashApi.Validation.ApiJobScheduledResponse>(
      `/projects/${projectUuid}/validate`,
      body,
    );
  }
}
