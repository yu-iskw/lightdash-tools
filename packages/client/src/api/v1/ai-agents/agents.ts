/**
 * Project-scoped AI agent CRUD client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgent,
  AiAgentSummary,
  CreateAiAgent,
  UpdateAiAgent,
} from '@lightdash-tools/common';

export class AiAgentsProjectClient extends BaseApiClient {
  /** List all agents in a project (GET /projects/{projectUuid}/aiAgents). */
  async listAgents(projectUuid: string): Promise<AiAgentSummary[]> {
    return this.http.get<AiAgentSummary[]>(`/projects/${projectUuid}/aiAgents`);
  }

  /** Get a single agent by UUID (GET /projects/{projectUuid}/aiAgents/{agentUuid}). */
  async getAgent(projectUuid: string, agentUuid: string): Promise<AiAgent> {
    return this.http.get<AiAgent>(`/projects/${projectUuid}/aiAgents/${agentUuid}`);
  }

  /** Create a new agent in a project (POST /projects/{projectUuid}/aiAgents). */
  async createAgent(projectUuid: string, body: CreateAiAgent): Promise<AiAgent> {
    return this.http.post<AiAgent>(`/projects/${projectUuid}/aiAgents`, body, undefined, {
      maxRetries: 0,
    });
  }

  /** Update an existing agent (PATCH /projects/{projectUuid}/aiAgents/{agentUuid}). */
  async updateAgent(projectUuid: string, agentUuid: string, body: UpdateAiAgent): Promise<AiAgent> {
    return this.http.patch<AiAgent>(`/projects/${projectUuid}/aiAgents/${agentUuid}`, body);
  }

  /** Delete an agent (DELETE /projects/{projectUuid}/aiAgents/{agentUuid}). */
  async deleteAgent(projectUuid: string, agentUuid: string): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/aiAgents/${agentUuid}`);
  }
}
