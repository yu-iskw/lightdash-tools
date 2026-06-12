/**
 * AI agents admin API client.
 * Endpoints: /api/v1/aiAgents/admin/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgentSummary,
  AiAgentsAdminThreadsResult,
  GetAdminThreadsParams,
  GetAiOrganizationSettingsResult,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
} from '@lightdash-tools/common';

export class AiAgentsAdminClient extends BaseApiClient {
  /** List all AI agent threads across the org (admin). Supports pagination and filters. */
  async getAdminThreads(params?: GetAdminThreadsParams): Promise<AiAgentsAdminThreadsResult> {
    return this.http.get<AiAgentsAdminThreadsResult>('/aiAgents/admin/threads', {
      params,
    });
  }

  /** List all AI agents across the org (admin). */
  async listAdminAgents(): Promise<AiAgentSummary[]> {
    return this.http.get<AiAgentSummary[]>('/aiAgents/admin/agents');
  }

  /** Get AI organization settings. */
  async getAiOrganizationSettings(): Promise<GetAiOrganizationSettingsResult> {
    return this.http.get<GetAiOrganizationSettingsResult>('/aiAgents/admin/settings');
  }

  /** Update AI organization settings. */
  async updateAiOrganizationSettings(
    body: UpdateAiOrganizationSettings,
  ): Promise<UpdateAiOrganizationSettingsResult> {
    return this.http.patch<UpdateAiOrganizationSettingsResult>('/aiAgents/admin/settings', body);
  }
}
