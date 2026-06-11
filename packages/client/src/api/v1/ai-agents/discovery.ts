/**
 * AI agent discovery and preferences client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AgentSuggestions,
  AiAgentExploreAccessSummary,
  AiAgentUserPreferences,
  AiModelOption,
  ExploreAccessSummaryBody,
  GetAgentSuggestionsParams,
  ReadinessScore,
} from '@lightdash-tools/common';

export class AiAgentsDiscoveryClient extends BaseApiClient {
  /** Available model options for an agent (GET …/{agentUuid}/models). */
  async getAgentModelOptions(projectUuid: string, agentUuid: string): Promise<AiModelOption[]> {
    return this.http.get<AiModelOption[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/models`,
    );
  }

  /** Suggestion chips for an agent (GET …/{agentUuid}/suggestions). */
  async getAgentSuggestions(
    projectUuid: string,
    agentUuid: string,
    params?: GetAgentSuggestionsParams,
  ): Promise<AgentSuggestions> {
    return this.http.get<AgentSuggestions>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/suggestions`,
      { params },
    );
  }

  /** Evaluate agent readiness (POST …/{agentUuid}/evaluateReadiness). */
  async evaluateAgentReadiness(
    projectUuid: string,
    agentUuid: string,
  ): Promise<ReadinessScore> {
    return this.http.post<ReadinessScore>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluateReadiness`,
      {},
    );
  }

  /**
   * Summarize explore access for tag-filtered explores
   * (POST …/explore-access-summary).
   */
  async getExploreAccessSummary(
    projectUuid: string,
    _agentUuid: string,
    body?: ExploreAccessSummaryBody,
  ): Promise<AiAgentExploreAccessSummary[]> {
    return this.http.post<AiAgentExploreAccessSummary[]>(
      `/projects/${projectUuid}/aiAgents/explore-access-summary`,
      body ?? { tags: null },
    );
  }

  /** Get user default agent preferences (GET …/preferences). */
  async getUserAgentPreferences(projectUuid: string): Promise<AiAgentUserPreferences> {
    return this.http.get<AiAgentUserPreferences>(
      `/projects/${projectUuid}/aiAgents/preferences`,
    );
  }

  /** Set user default agent preferences (POST …/preferences). */
  async setUserAgentPreferences(
    projectUuid: string,
    body: AiAgentUserPreferences,
  ): Promise<void> {
    await this.http.post<void>(`/projects/${projectUuid}/aiAgents/preferences`, body);
  }

  /** Clear user default agent preferences (DELETE …/preferences). */
  async deleteUserAgentPreferences(projectUuid: string): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/aiAgents/preferences`);
  }
}
