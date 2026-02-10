/**
 * Charts API client. Endpoints for saved charts and chart-related operations.
 */

import type { SpaceQuery } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

export class ChartsClient extends BaseApiClient {
  /** List charts in a project (returns SpaceQuery array). */
  async listCharts(projectUuid: string): Promise<SpaceQuery[]> {
    return this.http.get<SpaceQuery[]>(`/projects/${projectUuid}/charts`);
  }
}
