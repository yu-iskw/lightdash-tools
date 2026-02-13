/**
 * Schedulers API client.
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

/** Query params for listing schedulers. */
export interface ListSchedulersParams {
  pageSize?: number;
  page?: number;
  searchQuery?: string;
  sortBy?: 'name' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  createdByUserUuids?: string;
  formats?: string;
  resourceType?: 'chart' | 'dashboard';
  resourceUuids?: string;
  destinations?: string;
  includeLatestRun?: boolean;
}

export class SchedulersClient extends BaseApiClient {
  /** List schedulers in a project. */
  async listSchedulers(
    projectUuid: string,
    params?: ListSchedulersParams,
  ): Promise<LightdashApi.Schedulers.ApiSchedulersResponse> {
    return this.http.get<LightdashApi.Schedulers.ApiSchedulersResponse>(
      `/schedulers/${projectUuid}/list`,
      { params },
    );
  }

  /** Get a scheduler by UUID. */
  async getScheduler(
    schedulerUuid: string,
  ): Promise<LightdashApi.Schedulers.ApiSchedulerAndTargetsResponse> {
    return this.http.get<LightdashApi.Schedulers.ApiSchedulerAndTargetsResponse>(
      `/schedulers/${schedulerUuid}`,
    );
  }
}
