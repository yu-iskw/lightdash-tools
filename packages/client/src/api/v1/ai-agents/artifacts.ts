/**
 * AI agent artifacts client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/artifacts/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgentThreadMessageVizQuery,
  AiAgentVerifiedArtifactsListResult,
  AiAgentVerifiedQuestion,
  AiArtifact,
  ListVerifiedArtifactsParams,
} from '@lightdash-tools/common';

export class AiAgentsArtifactsClient extends BaseApiClient {
  /** List verified artifacts with pagination (GET …/verified-artifacts). */
  async listVerifiedArtifacts(
    projectUuid: string,
    agentUuid: string,
    params?: ListVerifiedArtifactsParams,
  ): Promise<AiAgentVerifiedArtifactsListResult> {
    return this.http.get<AiAgentVerifiedArtifactsListResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/verified-artifacts`,
      { params },
    );
  }

  /** List verified questions (GET …/verified-questions). */
  async listVerifiedQuestions(
    projectUuid: string,
    agentUuid: string,
  ): Promise<AiAgentVerifiedQuestion[]> {
    return this.http.get<AiAgentVerifiedQuestion[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/verified-questions`,
    );
  }

  /** Get the latest artifact version (GET …/artifacts/{artifactUuid}). */
  async getArtifact(
    projectUuid: string,
    agentUuid: string,
    artifactUuid: string,
  ): Promise<AiArtifact> {
    return this.http.get<AiArtifact>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/artifacts/${artifactUuid}`,
    );
  }

  /** Get a specific artifact version (GET …/artifacts/{artifactUuid}/versions/{versionUuid}). */
  async getArtifactVersion(
    projectUuid: string,
    agentUuid: string,
    artifactUuid: string,
    versionUuid: string,
  ): Promise<AiArtifact> {
    return this.http.get<AiArtifact>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/artifacts/${artifactUuid}/versions/${versionUuid}`,
    );
  }

  /**
   * Get the viz query for a thread message
   * (GET …/threads/{threadUuid}/messages/{messageUuid}/viz-query).
   */
  async getMessageVizQuery(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    messageUuid: string,
  ): Promise<AiAgentThreadMessageVizQuery> {
    return this.http.get<AiAgentThreadMessageVizQuery>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/messages/${messageUuid}/viz-query`,
    );
  }
}
