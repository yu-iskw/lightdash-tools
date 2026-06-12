/**
 * Facade for the AI agents API client.
 * Delegates to domain-specific clients while preserving the monolithic public API.
 */

import { BaseApiClient } from '../../base-client';

import { AiAgentsAdminClient } from './admin';
import { AiAgentsProjectClient } from './agents';
import { AiAgentsArtifactsClient } from './artifacts';
import { AiAgentsDiscoveryClient } from './discovery';
import { AiAgentsEvaluationsClient } from './evaluations';
import { AiAgentsFeedbackClient } from './feedback';
import { AiAgentsMcpServersClient } from './mcp-servers';
import { AiAgentsSqlApprovalClient } from './sql-approval';
import { AiAgentsThreadsClient } from './threads';

import type { RequestOptions } from './request-options';
import type { HttpClient } from '../../../http/http-client';
import type {
  AgentSuggestions,
  AiAgent,
  AiAgentEvaluation,
  AiAgentEvaluationRun,
  AiAgentEvaluationRunSummary,
  AiAgentEvaluationRunsListResponse,
  AiAgentEvaluationSummary,
  AiAgentExploreAccessSummary,
  AiAgentMcpServerTool,
  AiAgentsAdminThreadsResult,
  AiAgentSummary,
  AiAgentThread,
  AiAgentThreadMessageVizQuery,
  AiAgentThreadSummary,
  AiAgentUserPreferences,
  AiAgentVerifiedArtifactsListResult,
  AiAgentVerifiedQuestion,
  AiArtifact,
  AiMcpServer,
  AiMcpServerTool,
  AiModelOption,
  AppendEvaluationBody,
  CloneThreadBody,
  CreateAgentThreadBody,
  CreateAgentThreadMessageResult,
  CreateAiAgent,
  CreateEvaluationBody,
  CreateEvaluationResult,
  CreateProjectMcpServerBody,
  ExploreAccessSummaryBody,
  GenerateAgentThreadBody,
  GenerateAgentThreadResult,
  GenerateThreadTitleResult,
  GetAdminThreadsParams,
  GetAgentSuggestionsParams,
  GetAiOrganizationSettingsResult,
  ListVerifiedArtifactsParams,
  ReadinessScore,
  SubmitSqlApprovalBody,
  SubmitSqlApprovalResult,
  UpdateAiAgent,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
  UpdateAgentMcpServerToolsBody,
  UpdateEvaluationBody,
  UpdateMessageFeedbackBody,
} from '@lightdash-tools/common';

export class AiAgentsClient extends BaseApiClient {
  private readonly admin: AiAgentsAdminClient;
  private readonly agents: AiAgentsProjectClient;
  private readonly artifacts: AiAgentsArtifactsClient;
  private readonly discovery: AiAgentsDiscoveryClient;
  private readonly threads: AiAgentsThreadsClient;
  private readonly evaluations: AiAgentsEvaluationsClient;
  private readonly feedback: AiAgentsFeedbackClient;
  private readonly mcpServers: AiAgentsMcpServersClient;
  private readonly sqlApproval: AiAgentsSqlApprovalClient;

  constructor(http: HttpClient) {
    super(http);
    this.admin = new AiAgentsAdminClient(http);
    this.agents = new AiAgentsProjectClient(http);
    this.artifacts = new AiAgentsArtifactsClient(http);
    this.discovery = new AiAgentsDiscoveryClient(http);
    this.threads = new AiAgentsThreadsClient(http);
    this.evaluations = new AiAgentsEvaluationsClient(http);
    this.feedback = new AiAgentsFeedbackClient(http);
    this.mcpServers = new AiAgentsMcpServersClient(http);
    this.sqlApproval = new AiAgentsSqlApprovalClient(http);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  getAdminThreads(params?: GetAdminThreadsParams): Promise<AiAgentsAdminThreadsResult> {
    return this.admin.getAdminThreads(params);
  }

  listAdminAgents(): Promise<AiAgentSummary[]> {
    return this.admin.listAdminAgents();
  }

  getAiOrganizationSettings(): Promise<GetAiOrganizationSettingsResult> {
    return this.admin.getAiOrganizationSettings();
  }

  updateAiOrganizationSettings(
    body: UpdateAiOrganizationSettings,
  ): Promise<UpdateAiOrganizationSettingsResult> {
    return this.admin.updateAiOrganizationSettings(body);
  }

  // ─── Project-scoped: agent CRUD ──────────────────────────────────────────────

  listAgents(projectUuid: string): Promise<AiAgentSummary[]> {
    return this.agents.listAgents(projectUuid);
  }

  getAgent(projectUuid: string, agentUuid: string): Promise<AiAgent> {
    return this.agents.getAgent(projectUuid, agentUuid);
  }

  createAgent(projectUuid: string, body: CreateAiAgent): Promise<AiAgent> {
    return this.agents.createAgent(projectUuid, body);
  }

  updateAgent(projectUuid: string, agentUuid: string, body: UpdateAiAgent): Promise<AiAgent> {
    return this.agents.updateAgent(projectUuid, agentUuid, body);
  }

  deleteAgent(projectUuid: string, agentUuid: string): Promise<void> {
    return this.agents.deleteAgent(projectUuid, agentUuid);
  }

  // ─── Discovery & preferences ─────────────────────────────────────────────────

  getAgentModelOptions(projectUuid: string, agentUuid: string): Promise<AiModelOption[]> {
    return this.discovery.getAgentModelOptions(projectUuid, agentUuid);
  }

  getAgentSuggestions(
    projectUuid: string,
    agentUuid: string,
    params?: GetAgentSuggestionsParams,
  ): Promise<AgentSuggestions> {
    return this.discovery.getAgentSuggestions(projectUuid, agentUuid, params);
  }

  evaluateAgentReadiness(projectUuid: string, agentUuid: string): Promise<ReadinessScore> {
    return this.discovery.evaluateAgentReadiness(projectUuid, agentUuid);
  }

  getExploreAccessSummary(
    projectUuid: string,
    agentUuid: string,
    body?: ExploreAccessSummaryBody,
  ): Promise<AiAgentExploreAccessSummary[]> {
    return this.discovery.getExploreAccessSummary(projectUuid, agentUuid, body);
  }

  getUserAgentPreferences(projectUuid: string): Promise<AiAgentUserPreferences | null> {
    return this.discovery.getUserAgentPreferences(projectUuid);
  }

  setUserAgentPreferences(projectUuid: string, body: AiAgentUserPreferences): Promise<void> {
    return this.discovery.setUserAgentPreferences(projectUuid, body);
  }

  deleteUserAgentPreferences(projectUuid: string): Promise<void> {
    return this.discovery.deleteUserAgentPreferences(projectUuid);
  }

  // ─── Project-scoped: threads ─────────────────────────────────────────────────

  listAgentThreads(projectUuid: string, agentUuid: string): Promise<AiAgentThreadSummary[]> {
    return this.threads.listAgentThreads(projectUuid, agentUuid);
  }

  createAgentThread(
    projectUuid: string,
    agentUuid: string,
    body?: CreateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<AiAgentThreadSummary> {
    return this.threads.createAgentThread(projectUuid, agentUuid, body, options);
  }

  getAgentThread(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<AiAgentThread> {
    return this.threads.getAgentThread(projectUuid, agentUuid, threadUuid, options);
  }

  createAgentThreadMessage(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<CreateAgentThreadMessageResult> {
    return this.threads.createAgentThreadMessage(projectUuid, agentUuid, threadUuid, body, options);
  }

  generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult>;

  generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult>;

  generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    bodyOrOptions?: GenerateAgentThreadBody | RequestOptions,
    maybeOptions?: RequestOptions,
  ): Promise<GenerateAgentThreadResult> {
    if (
      bodyOrOptions !== undefined &&
      typeof bodyOrOptions === 'object' &&
      'prompt' in bodyOrOptions
    ) {
      return this.threads.generateAgentThreadResponse(
        projectUuid,
        agentUuid,
        threadUuid,
        bodyOrOptions,
        maybeOptions,
      );
    }

    return this.threads.generateAgentThreadResponse(
      projectUuid,
      agentUuid,
      threadUuid,
      bodyOrOptions as RequestOptions | undefined,
    );
  }

  startConversation(
    projectUuid: string,
    agentUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions & { threadBody?: CreateAgentThreadBody },
  ): Promise<{ thread: AiAgentThreadSummary; result: GenerateAgentThreadResult }> {
    return this.threads.startConversation(projectUuid, agentUuid, body, options);
  }

  continueConversation(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult> {
    return this.threads.continueConversation(projectUuid, agentUuid, threadUuid, body, options);
  }

  generateThreadTitle(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<GenerateThreadTitleResult> {
    return this.threads.generateThreadTitle(projectUuid, agentUuid, threadUuid, options);
  }

  cloneThread(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body?: CloneThreadBody,
  ): Promise<AiAgentThreadSummary> {
    return this.threads.cloneThread(projectUuid, agentUuid, threadUuid, body);
  }

  // ─── Artifacts ───────────────────────────────────────────────────────────────

  listVerifiedArtifacts(
    projectUuid: string,
    agentUuid: string,
    params?: ListVerifiedArtifactsParams,
  ): Promise<AiAgentVerifiedArtifactsListResult> {
    return this.artifacts.listVerifiedArtifacts(projectUuid, agentUuid, params);
  }

  listVerifiedQuestions(
    projectUuid: string,
    agentUuid: string,
  ): Promise<AiAgentVerifiedQuestion[]> {
    return this.artifacts.listVerifiedQuestions(projectUuid, agentUuid);
  }

  getArtifact(projectUuid: string, agentUuid: string, artifactUuid: string): Promise<AiArtifact> {
    return this.artifacts.getArtifact(projectUuid, agentUuid, artifactUuid);
  }

  getArtifactVersion(
    projectUuid: string,
    agentUuid: string,
    artifactUuid: string,
    versionUuid: string,
  ): Promise<AiArtifact> {
    return this.artifacts.getArtifactVersion(projectUuid, agentUuid, artifactUuid, versionUuid);
  }

  getArtifactVersionVizQuery(
    projectUuid: string,
    agentUuid: string,
    artifactUuid: string,
    versionUuid: string,
  ): Promise<AiAgentThreadMessageVizQuery> {
    return this.artifacts.getArtifactVersionVizQuery(
      projectUuid,
      agentUuid,
      artifactUuid,
      versionUuid,
    );
  }

  getDashboardArtifactChartVizQuery(
    projectUuid: string,
    agentUuid: string,
    artifactUuid: string,
    versionUuid: string,
    chartIndex: number,
  ): Promise<AiAgentThreadMessageVizQuery> {
    return this.artifacts.getDashboardArtifactChartVizQuery(
      projectUuid,
      agentUuid,
      artifactUuid,
      versionUuid,
      chartIndex,
    );
  }

  // ─── Message feedback ────────────────────────────────────────────────────────

  updateMessageFeedback(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    messageUuid: string,
    body: UpdateMessageFeedbackBody,
  ): Promise<void> {
    return this.feedback.updateMessageFeedback(
      projectUuid,
      agentUuid,
      threadUuid,
      messageUuid,
      body,
    );
  }

  // ─── MCP servers (EE-guarded upstream) ───────────────────────────────────────

  listProjectMcpServers(projectUuid: string): Promise<AiMcpServer[]> {
    return this.mcpServers.listProjectMcpServers(projectUuid);
  }

  createProjectMcpServer(
    projectUuid: string,
    body: CreateProjectMcpServerBody,
  ): Promise<AiMcpServer> {
    return this.mcpServers.createProjectMcpServer(projectUuid, body);
  }

  listMcpServerTools(projectUuid: string, mcpServerUuid: string): Promise<AiMcpServerTool[]> {
    return this.mcpServers.listMcpServerTools(projectUuid, mcpServerUuid);
  }

  refreshMcpServerTools(projectUuid: string, mcpServerUuid: string): Promise<AiMcpServerTool[]> {
    return this.mcpServers.refreshMcpServerTools(projectUuid, mcpServerUuid);
  }

  listAgentMcpServers(projectUuid: string, agentUuid: string): Promise<AiMcpServer[]> {
    return this.mcpServers.listAgentMcpServers(projectUuid, agentUuid);
  }

  updateAgentMcpServerTools(
    projectUuid: string,
    agentUuid: string,
    mcpServerUuid: string,
    body: UpdateAgentMcpServerToolsBody,
  ): Promise<AiAgentMcpServerTool[]> {
    return this.mcpServers.updateAgentMcpServerTools(projectUuid, agentUuid, mcpServerUuid, body);
  }

  // ─── SQL approval ────────────────────────────────────────────────────────────

  submitSqlApproval(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    toolCallId: string,
    body: SubmitSqlApprovalBody,
  ): Promise<SubmitSqlApprovalResult> {
    return this.sqlApproval.submitSqlApproval(projectUuid, agentUuid, threadUuid, toolCallId, body);
  }

  // ─── Project-scoped: evaluations ─────────────────────────────────────────────

  listEvaluations(projectUuid: string, agentUuid: string): Promise<AiAgentEvaluationSummary[]> {
    return this.evaluations.listEvaluations(projectUuid, agentUuid);
  }

  createEvaluation(
    projectUuid: string,
    agentUuid: string,
    body: CreateEvaluationBody,
  ): Promise<CreateEvaluationResult> {
    return this.evaluations.createEvaluation(projectUuid, agentUuid, body);
  }

  getEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluation> {
    return this.evaluations.getEvaluation(projectUuid, agentUuid, evalUuid);
  }

  updateEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    body: UpdateEvaluationBody,
  ): Promise<AiAgentEvaluation> {
    return this.evaluations.updateEvaluation(projectUuid, agentUuid, evalUuid, body);
  }

  appendToEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    body: AppendEvaluationBody,
  ): Promise<AiAgentEvaluation> {
    return this.evaluations.appendToEvaluation(projectUuid, agentUuid, evalUuid, body);
  }

  deleteEvaluation(projectUuid: string, agentUuid: string, evalUuid: string): Promise<void> {
    return this.evaluations.deleteEvaluation(projectUuid, agentUuid, evalUuid);
  }

  runEvaluation(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunSummary> {
    return this.evaluations.runEvaluation(projectUuid, agentUuid, evalUuid);
  }

  listEvaluationRuns(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    params?: { page?: number; pageSize?: number },
  ): Promise<AiAgentEvaluationRunsListResponse> {
    return this.evaluations.listEvaluationRuns(projectUuid, agentUuid, evalUuid, params);
  }

  listAllEvaluationRuns(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
  ): Promise<AiAgentEvaluationRunSummary[]> {
    return this.evaluations.listAllEvaluationRuns(projectUuid, agentUuid, evalUuid);
  }

  getEvaluationRunResults(
    projectUuid: string,
    agentUuid: string,
    evalUuid: string,
    runUuid: string,
  ): Promise<AiAgentEvaluationRun> {
    return this.evaluations.getEvaluationRunResults(projectUuid, agentUuid, evalUuid, runUuid);
  }
}
