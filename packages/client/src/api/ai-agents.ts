/**
 * AI agents API client. Admin endpoints for listing agents, threads, and managing org AI settings.
 */

import type {
  AiAgentSummary,
  AiAgentsAdminThreadsResult,
  GetAdminThreadsParams,
  GetAiOrganizationSettingsResult,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
} from '@lightdash-ai/common';
import { BaseApiClient } from './base-client';

export class AiAgentsClient extends BaseApiClient {
  /**
   * List all AI agent threads (admin). Supports pagination and filters.
   */
  async getAdminThreads(params?: GetAdminThreadsParams): Promise<AiAgentsAdminThreadsResult> {
    return this.http.get<AiAgentsAdminThreadsResult>('/aiAgents/admin/threads', {
      params,
    });
  }

  /** List all AI agents (admin). */
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
