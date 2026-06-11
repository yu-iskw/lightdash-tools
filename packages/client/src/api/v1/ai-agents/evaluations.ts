/**
 * Project-scoped AI agent evaluation client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/evaluations/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgentEvaluation,
  AiAgentEvaluationRun,
  AiAgentEvaluationRunSummary,
  AiAgentEvaluationRunsListResponse,
  AiAgentEvaluationSummary,
  AppendEvaluationBody,
  CreateEvaluationBody,
  CreateEvaluationResult,
  UpdateEvaluationBody,
} from '@lightdash-tools/common';

export class AiAgentsEvaluationsClient extends BaseApiClient {
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
  ): Promise<AiAgentEvaluation> {
    return this.http.post<AiAgentEvaluation>(
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

  /** List runs for an evaluation with pagination (GET …/evaluations/{evalUuid}/runs). */
  async listEvaluationRuns(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunsListResponse> {
    return this.http.get<AiAgentEvaluationRunsListResponse>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/evaluations/${evalUuid}/runs`,
    );
  }

  /**
   * List all runs for an evaluation, returning only the runs array.
   * Convenience wrapper around {@link listEvaluationRuns} for backward compatibility.
   */
  async listAllEvaluationRuns(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunSummary[]> {
    const response = await this.listEvaluationRuns(projectUuid, agentUuid, evalUuid);
    return response.data.runs;
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
