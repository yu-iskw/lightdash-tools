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
   * Request body for adding a user message to a thread
   * (POST …/threads/{threadUuid}/messages).
   */
  export type CreateAgentThreadMessageBody =
    components['schemas']['ApiAiAgentThreadMessageCreateRequest'];
  /** User message returned after creating a thread message. */
  export type CreateAgentThreadMessageResult =
    components['schemas']['ApiAiAgentThreadMessageCreateResponse']['results'];
  /**
   * Request body for generating/continuing a thread response.
   * @deprecated Use {@link CreateAgentThreadMessageBody} with the messages endpoint.
   */
  export type GenerateAgentThreadBody = CreateAgentThreadMessageBody;
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

  // ─── Discovery & preferences ───────────────────────────────────────────────────

  /** Available AI model option for an agent (GET …/{agentUuid}/models). */
  export type AiModelOption = components['schemas']['AiModelOption'];
  /** Agent readiness evaluation score (POST …/{agentUuid}/evaluateReadiness). */
  export type ReadinessScore = components['schemas']['ReadinessScore'];
  /** Per-explore field access summary (POST …/explore-access-summary). */
  export type AiAgentExploreAccessSummary = components['schemas']['AiAgentExploreAccessSummary'];
  /** Request body for explore access summary. */
  export interface ExploreAccessSummaryBody {
    tags: string[] | null;
  }
  /** User default agent preferences (GET/POST/DELETE …/preferences). */
  export type AiAgentUserPreferences = components['schemas']['AiAgentUserPreferences'];
  /** Query params for agent suggestion chips (GET …/{agentUuid}/suggestions). */
  export interface GetAgentSuggestionsParams {
    threadUuid?: string;
    afterMessageUuid?: string;
    enableSqlMode?: boolean;
  }
  /** Suggestion chip returned by the suggestions endpoint. */
  export interface AgentSuggestionChip {
    label: string;
    defaults?: {
      timeframe?: string;
      metrics?: string[];
      dimensions?: string[];
      explore?: string;
    };
  }
  /** Suggestion chips wrapper (inner `results` of suggestions response). */
  export interface AgentSuggestions {
    chips: AgentSuggestionChip[];
  }

  // ─── Threads: title & clone ────────────────────────────────────────────────────

  /** Title generated for a thread (POST …/threads/{threadUuid}/generate-title). */
  export type GenerateThreadTitleResult =
    components['schemas']['ApiAiAgentThreadGenerateTitleResponse']['results'];
  /** Options for cloning a thread from a prompt (POST …/clone/{promptUuid}). */
  export interface CloneThreadBody {
    promptUuid: string;
    createdFrom?: 'web_app' | 'evals';
  }

  // ─── Artifacts ─────────────────────────────────────────────────────────────────

  /** Verified artifact summary (GET …/verified-artifacts). */
  export type AiAgentVerifiedArtifact = components['schemas']['AiAgentVerifiedArtifact'];
  /** Paginated verified artifacts list (`results` of verified-artifacts response). */
  export type AiAgentVerifiedArtifactsListResult =
    components['schemas']['KnexPaginatedData_AiAgentVerifiedArtifact-Array_'];
  /** Query params for listing verified artifacts. */
  export interface ListVerifiedArtifactsParams {
    page?: number;
    pageSize?: number;
  }
  /** Verified question entry (GET …/verified-questions). */
  export type AiAgentVerifiedQuestion =
    components['schemas']['ApiAiAgentVerifiedQuestionsResponse']['results'][number];
  /** Full artifact payload (GET …/artifacts/{artifactUuid}). */
  export type AiArtifact = components['schemas']['AiArtifactTSOACompat'];
  /** Viz query payload for a thread message or artifact version. */
  export type AiAgentThreadMessageVizQuery =
    components['schemas']['ApiAiAgentThreadMessageVizQuery'];

  // ─── Message feedback ──────────────────────────────────────────────────────────

  /** Request body for PATCH …/messages/{messageUuid}/feedback. */
  export interface UpdateMessageFeedbackBody {
    humanScore: number;
    humanFeedback?: string | null;
  }

  // ─── MCP servers (project-scoped; EE-guarded upstream) ───────────────────────

  /** MCP server auth type. */
  export type AiMcpServerAuthType = 'none' | 'bearer' | 'oauth';
  /** MCP server connection status. */
  export type AiMcpServerConnectionStatus = 'connected' | 'disconnected' | 'error';
  /** Project MCP server record. */
  export interface AiMcpServer {
    uuid: string;
    projectUuid: string;
    name: string;
    url: string;
    iconUrl: string | null;
    authType: AiMcpServerAuthType;
    allowOAuthCredentialSharing: boolean;
    hasCredentials: boolean;
    credentialScope: string | null;
    connectionStatus: AiMcpServerConnectionStatus | null;
    error: string | null;
    connectedByUserUuid: string | null;
    createdAt: string;
    updatedAt: string;
  }
  /** MCP tool discovered on a project server. */
  export interface AiMcpServerTool {
    uuid: string;
    mcpServerUuid: string;
    toolName: string;
    title: string | null;
    description: string | null;
    inputSchema: unknown;
    annotations: unknown;
    meta: unknown;
    createdAt: string;
    updatedAt: string;
  }
  /** MCP tool with per-agent enablement. */
  export type AiAgentMcpServerTool = AiMcpServerTool & {
    enabled: boolean;
    agentUuid: string;
  };
  /** Request body for creating a project MCP server. */
  export interface CreateProjectMcpServerBody {
    name: string;
    url: string;
    authType: AiMcpServerAuthType;
    allowOAuthCredentialSharing?: boolean;
    credentialScope?: string | null;
    credentials?: { bearerToken: string } | null;
  }
  /** Tool enablement update for an agent MCP server. */
  export interface AiAgentMcpServerToolUpdate {
    toolName: string;
    enabled: boolean;
  }
  /** Request body for PATCH …/{agentUuid}/mcpServers/{mcpServerUuid}/tools. */
  export interface UpdateAgentMcpServerToolsBody {
    toolSettings: AiAgentMcpServerToolUpdate[];
  }

  // ─── SQL approval ──────────────────────────────────────────────────────────────

  /** SQL approval decision. */
  export type SqlApprovalDecision = 'approved' | 'rejected';
  /** Request body for POST …/tool-calls/{toolCallId}/sql-approval. */
  export interface SubmitSqlApprovalBody {
    decision: SqlApprovalDecision;
  }
  /** SQL approval response (`results` of sql-approval response). */
  export interface SubmitSqlApprovalResult {
    decision: SqlApprovalDecision;
  }
}
