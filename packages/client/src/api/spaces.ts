/**
 * Spaces API client.
 */

import type { SpaceSummary } from '@lightdash-ai/common';
import { BaseApiClient } from './base-client';

export class SpacesClient extends BaseApiClient {
  /** List spaces in a project. */
  async listSpacesInProject(projectUuid: string): Promise<SpaceSummary[]> {
    return this.http.get<SpaceSummary[]>(`/projects/${projectUuid}/spaces`);
  }
}
