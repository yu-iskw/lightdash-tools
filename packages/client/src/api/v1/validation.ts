/**
 * Validation API client.
 */

import { BaseApiClient } from '../base-client';

import type { components, LightdashApi } from '@lightdash-tools/common';

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
  /**
   * Get validation results for a project.
   * @deprecated Use v2 validation API (ListValidationResults) instead.
   */
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

  /** Validate a single chart's fields against its underlying explore/table. */
  async validateChart(
    projectUuid: string,
    chartUuid: string,
  ): Promise<components['schemas']['ApiChartValidationResponse']> {
    return this.http.post<components['schemas']['ApiChartValidationResponse']>(
      `/projects/${projectUuid}/validate/chart/${chartUuid}`,
    );
  }

  /** Validate a single dashboard's fields against its underlying explores/tables. */
  async validateDashboard(
    projectUuid: string,
    dashboardUuid: string,
  ): Promise<components['schemas']['ApiDashboardValidationResponse']> {
    return this.http.post<components['schemas']['ApiDashboardValidationResponse']>(
      `/projects/${projectUuid}/validate/dashboard/${dashboardUuid}`,
    );
  }
}
