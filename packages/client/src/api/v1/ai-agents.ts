/**
 * AI agents API client.
 *
 * Admin endpoints  → /api/v1/aiAgents/admin/...
 * Project-scoped   → /api/v1/projects/{projectUuid}/aiAgents/...
 */

import type {
  AiAgentSummary,
  AiAgentsAdminThreadsResult,
  GetAdminThreadsParams,
  GetAiOrganizationSettingsResult,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
  AiAgent,
  CreateAiAgent,
  UpdateAiAgent,
  AiAgentThreadSummary,
  AiAgentThread,
  CreateAgentThreadBody,
  GenerateAgentThreadBody,
  GenerateAgentThreadResult,
  CreateEvaluationBody,
  CreateEvaluationResult,
  UpdateEvaluationBody,
  AppendEvaluationBody,
  AiAgentEvaluationSummary,
  AiAgentEvaluation,
  AiAgentEvaluationRunSummary,
  AiAgentEvaluationRun,
} from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

export class AiAgentsClient extends BaseApiClient {
  // ─── Admin: threads ──────────────────────────────────────────────────────────

  /** List all AI agent threads across the org (admin). Supports pagination and filters. */
  async getAdminThreads(params?: GetAdminThreadsParams): Promise<AiAgentsAdminThreadsResult> {
    return this.http.get<AiAgentsAdminThreadsResult>('/aiAgents/admin/threads', {
      params,
    });
  }

  // ─── Admin: agents ───────────────────────────────────────────────────────────

  /** List all AI agents across the org (admin). */
  async listAdminAgents(): Promise<AiAgentSummary[]> {
    return this.http.get<AiAgentSummary[]>('/aiAgents/admin/agents');
  }

  // ─── Admin: settings ─────────────────────────────────────────────────────────

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

  // ─── Project-scoped: agent CRUD ──────────────────────────────────────────────

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
    return this.http.post<AiAgent>(`/projects/${projectUuid}/aiAgents`, body);
  }

  /** Update an existing agent (PATCH /projects/{projectUuid}/aiAgents/{agentUuid}). */
  async updateAgent(projectUuid: string, agentUuid: string, body: UpdateAiAgent): Promise<AiAgent> {
    return this.http.patch<AiAgent>(`/projects/${projectUuid}/aiAgents/${agentUuid}`, body);
  }

  /** Delete an agent (DELETE /projects/{projectUuid}/aiAgents/{agentUuid}). */
  async deleteAgent(projectUuid: string, agentUuid: string): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/aiAgents/${agentUuid}`);
  }

  // ─── Project-scoped: threads ─────────────────────────────────────────────────

  /** List all threads for an agent (GET /projects/{projectUuid}/aiAgents/{agentUuid}/threads). */
  async listAgentThreads(projectUuid: string, agentUuid: string): Promise<AiAgentThreadSummary[]> {
    return this.http.get<AiAgentThreadSummary[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads`,
    );
  }

  /**
   * Create a new thread (POST /projects/{projectUuid}/aiAgents/{agentUuid}/threads).
   * Pass `prompt` in the body to trigger an immediate generation.
   */
  async createAgentThread(
    projectUuid: string,
    agentUuid: string,
    body?: CreateAgentThreadBody,
  ): Promise<AiAgentThreadSummary> {
    return this.http.post<AiAgentThreadSummary>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads`,
      body ?? {},
    );
  }

  /** Get a thread with its messages (GET …/threads/{threadUuid}). */
  async getAgentThread(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
  ): Promise<AiAgentThread> {
    return this.http.get<AiAgentThread>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}`,
    );
  }

  /**
   * Generate a response in a thread (POST …/threads/{threadUuid}/generate).
   * Use this to send a prompt and receive the agent's reply.
   */
  async generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
  ): Promise<GenerateAgentThreadResult> {
    return this.http.post<GenerateAgentThreadResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/generate`,
      body,
    );
  }

  // ─── Project-scoped: evaluations ─────────────────────────────────────────────

  /** List all evaluations for an agent (GET …/{agentUuid}/evaluations). */
  async listEvaluations(
    projectUuid: string,
    agentUuid: string,
  ): Promise<AiAgentEvaluationSummary[]> {
    return this.http.get<AiAgentEvaluationSummary[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations`,
    );
  }

  /** Create a new evaluation (POST …/{agentUuid}/evaluations). */
  async createEvaluation(
    projectUuid: string,
    agentUuid: string,
    body: CreateEvaluationBody,
  ): Promise<CreateEvaluationResult> {
    return this.http.post<CreateEvaluationResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations`,
      body,
    );
  }

  /** Get a full evaluation with prompts (GET …/evaluations/{evalUuid}). */
  async getEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluation> {
    return this.http.get<AiAgentEvaluation>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}`,
    );
  }

  /** Update an evaluation's title, description, or prompts (PATCH …/evaluations/{evalUuid}). */
  async updateEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    body: UpdateEvaluationBody,
  ): Promise<AiAgentEvaluation> {
    return this.http.patch<AiAgentEvaluation>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}`,
      body,
    );
  }

  /** Append additional prompts to an existing evaluation (POST …/evaluations/{evalUuid}/append). */
  async appendToEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    body: AppendEvaluationBody,
  ): Promise<void> {
    await this.http.post(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}/append`,
      body,
    );
  }

  /** Delete an evaluation (DELETE …/evaluations/{evalUuid}). */
  async deleteEvaluation(projectUuid: string, agentUuid: string, evalUuid: string): Promise<void> {
    await this.http.delete(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}`,
    );
  }

  // ─── Project-scoped: evaluation runs ─────────────────────────────────────────

  /**
   * Trigger a new evaluation run (POST …/evaluations/{evalUuid}/run).
   * Returns a run summary with the new runUuid and initial status.
   */
  async runEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunSummary> {
    return this.http.post<AiAgentEvaluationRunSummary>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}/run`,
      {},
    );
  }

  /** List all runs for an evaluation (GET …/evaluations/{evalUuid}/runs). */
  async listEvaluationRuns(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunSummary[]> {
    return this.http.get<AiAgentEvaluationRunSummary[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}/runs`,
    );
  }

  /** Get detailed results of a specific run (GET …/evaluations/{evalUuid}/runs/{runUuid}). */
  async getEvaluationRunResults(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    runUuid: string,
  ): Promise<AiAgentEvaluationRun> {
    return this.http.get<AiAgentEvaluationRun>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}/runs/${runUuid}`,
    );
  }
}
