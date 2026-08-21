/**
 * AI Router API client.
 * Endpoints: /api/v1/org/aiRouter/...
 */

import { BaseApiClient } from '../../base-client';

import type { AiRouterRouteRequest, AiRouterRouteResponseResult } from '@lightdash-tools/common';

export class AiAgentsRouterClient extends BaseApiClient {
  /** Route a user prompt to the best accessible agent in the project. */
  async routeAiAgent(body: AiRouterRouteRequest): Promise<AiRouterRouteResponseResult> {
    return this.http.post<AiRouterRouteResponseResult>('/org/aiRouter/route', body);
  }
}
