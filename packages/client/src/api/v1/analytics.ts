/**
 * Analytics API client (v1). Project user-activity metadata (no CSV download).
 */

import { BaseApiClient } from '../base-client';

import type { components } from '@lightdash-tools/common';

export type UserActivity = components['schemas']['UserActivity'];

export class AnalyticsClient extends BaseApiClient {
  /** Get user activity summary for a project (views, role counts, unused-ish tables). */
  async getUserActivity(projectUuid: string): Promise<UserActivity> {
    return this.http.get<UserActivity>(`/analytics/user-activity/${projectUuid}`);
  }
}
