/**
 * AI agents domain models.
 * Extracted from OpenAPI specification for better maintainability.
 *
 * Admin endpoints: /api/v1/aiAgents/admin/...
 * Project-scoped endpoints: /api/v1/projects/{projectUuid}/aiAgents/...
 */

import type { components } from '../generated/openapi-types';

export namespace AiAgents {
  // ─── Admin types ────────────────────────────────────────────────────────────

  /** Summary of an AI agent returned by the admin list endpoint. */
  export type AiAgentSummary = components['schemas']['AiAgentSummary'];
  /** Sort field for the admin thread list. */
  export type AiAgentAdminSortField = components['schemas']['AiAgentAdminSortField'];
  /** Paginated result for admin threads (API response results). */
  export type AdminThreadsResult =
    components['schemas']['ApiAiAgentAdminConversationsResponse']['results'];
  /** Query params for listing admin threads (GET /aiAgents/admin/threads). */
  export interface GetAdminThreadsParams {
    page?: number;
    pageSize?: number;
    projectUuids?: string[];
    agentUuids?: string[];
    userUuids?: string[];
    createdFrom?: 'slack' | 'web_app';
    humanScore?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortField?: components['schemas']['AiAgentAdminSortField'];
    sortDirection?: 'asc' | 'desc';
  }
  /** AI organization settings returned by GET /aiAgents/admin/settings. */
  export type AiOrganizationSettings = components['schemas']['AiOrganizationSettings'];
  /** Computed AI org settings (included in get response). */
  export type ComputedAiOrganizationSettings =
    components['schemas']['ComputedAiOrganizationSettings'];
  /** Get AI org settings response results (settings + computed). */
  export type GetAiOrganizationSettingsResult =
    components['schemas']['ApiAiOrganizationSettingsResponse']['results'];
  /** Update AI org settings request body (PATCH /aiAgents/admin/settings). */
  export type UpdateAiOrganizationSettings = components['schemas']['UpdateAiOrganizationSettings'];
  /** Update AI org settings response results. */
  export type UpdateAiOrganizationSettingsResult =
    components['schemas']['ApiUpdateAiOrganizationSettingsResponse']['results'];

  // ─── Project-scoped agent CRUD ───────────────────────────────────────────────

  /** Full AI agent object returned by GET /projects/{projectUuid}/aiAgents/{agentUuid}. */
  export type AiAgent = components['schemas']['AiAgent'];
  /** Request body for creating an agent (POST /projects/{projectUuid}/aiAgents). */
  export type CreateAiAgent = components['schemas']['ApiCreateAiAgent'];
  /** Request body for updating an agent (PATCH /projects/{projectUuid}/aiAgents/{agentUuid}). */
  export type UpdateAiAgent = components['schemas']['ApiUpdateAiAgent'];

  // ─── Thread management ───────────────────────────────────────────────────────

  /** Thread summary (no messages) returned by list and create operations. */
  export type AiAgentThreadSummary = components['schemas']['AiAgentThreadSummary'];
  /** Full thread including messages, returned by GET …/threads/{threadUuid}. */
  export type AiAgentThread = components['schemas']['AiAgentThread'];
  /**
   * Request body for creating a new thread
   * (POST /projects/{projectUuid}/aiAgents/{agentUuid}/threads).
   * Include `prompt` to trigger immediate generation.
   */
  export type CreateAgentThreadBody = components['schemas']['ApiAiAgentThreadCreateRequest'];
  /**
   * Request body for generating/continuing a thread response
   * (POST …/threads/{threadUuid}/generate).
   */
  export type GenerateAgentThreadBody =
    components['schemas']['ApiAiAgentThreadMessageCreateRequest'];
  /** Response returned by the generate endpoint. */
  export type GenerateAgentThreadResult =
    components['schemas']['ApiAiAgentThreadGenerateResponse']['results'];

  // ─── Evaluations ────────────────────────────────────────────────────────────

  /** A prompt used in an evaluation (string prompt or reference to existing thread message). */
  export type CreateEvaluationPrompt = components['schemas']['CreateEvaluationPrompt'];
  /** Request body for creating an evaluation
   * (POST /projects/{projectUuid}/aiAgents/{agentUuid}/evaluations). */
  export type CreateEvaluationBody = components['schemas']['ApiCreateEvaluationRequest'];
  /** Evaluation UUID returned after creating an evaluation. */
  export type CreateEvaluationResult =
    components['schemas']['ApiCreateEvaluationResponse']['results'];
  /** Request body for updating an evaluation. */
  export type UpdateEvaluationBody = components['schemas']['ApiUpdateEvaluationRequest'];
  /** Request body for appending prompts to an existing evaluation. */
  export type AppendEvaluationBody = components['schemas']['ApiAppendEvaluationRequest'];
  /** Summary of an evaluation (used in list responses). */
  export type AiAgentEvaluationSummary = components['schemas']['AiAgentEvaluationSummary'];
  /** Full evaluation including its prompts. */
  export type AiAgentEvaluation = components['schemas']['AiAgentEvaluation'];

  // ─── Evaluation runs ─────────────────────────────────────────────────────────

  /** Summary of a single evaluation run. */
  export type AiAgentEvaluationRunSummary = components['schemas']['AiAgentEvaluationRunSummary'];
  /**
   * Paginated list response for evaluation runs.
   * Shape: `{ results: { data: { runs: AiAgentEvaluationRunSummary[] }, pagination? }, status }`.
   */
  export type AiAgentEvaluationRunsListResponse =
    components['schemas']['ApiAiAgentEvaluationRunSummaryListResponse']['results'];
  /** Full evaluation run including per-prompt results. */
  export type AiAgentEvaluationRun = components['schemas']['AiAgentEvaluationRun'];
  /** Individual result entry within a run (prompt + response + assessment). */
  export type AiAgentEvaluationRunResult = components['schemas']['AiAgentEvaluationRunResult'];
  /** Assessment (human or LLM-judge) for a single run result. */
  export type AiEvalRunResultAssessment = components['schemas']['AiEvalRunResultAssessment'];
  /** Assessment type: human or llm. */
  export type AssessmentType = components['schemas']['AssessmentType'];
}
