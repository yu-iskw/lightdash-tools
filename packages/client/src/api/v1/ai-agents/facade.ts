/**
 * Facade for the AI agents API client.
 * Delegates to domain-specific clients while preserving the monolithic public API.
 */

import { BaseApiClient } from '../../base-client';

import { AiAgentsAdminClient } from './admin';
import { AiAgentsProjectClient } from './agents';
import { AiAgentsEvaluationsClient } from './evaluations';
import { AiAgentsThreadsClient } from './threads';

import type { RequestOptions } from './request-options';
import type {
  AiAgent,
  AiAgentEvaluation,
  AiAgentEvaluationRun,
  AiAgentEvaluationRunSummary,
  AiAgentEvaluationRunsListResponse,
  AiAgentEvaluationSummary,
  AiAgentSummary,
  AiAgentsAdminThreadsResult,
  AiAgentThread,
  AiAgentThreadSummary,
  AppendEvaluationBody,
  CreateAgentThreadBody,
  CreateAgentThreadMessageResult,
  CreateAiAgent,
  CreateEvaluationBody,
  CreateEvaluationResult,
  GenerateAgentThreadBody,
  GenerateAgentThreadResult,
  GetAdminThreadsParams,
  GetAiOrganizationSettingsResult,
  UpdateAiAgent,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
  UpdateEvaluationBody,
} from '@lightdash-tools/common';
import type { HttpClient } from '../../../http/http-client';

export class AiAgentsClient extends BaseApiClient {
  private readonly admin: AiAgentsAdminClient;
  private readonly agents: AiAgentsProjectClient;
  private readonly threads: AiAgentsThreadsClient;
  private readonly evaluations: AiAgentsEvaluationsClient;

  constructor(http: HttpClient) {
    super(http);
    this.admin = new AiAgentsAdminClient(http);
    this.agents = new AiAgentsProjectClient(http);
    this.threads = new AiAgentsThreadsClient(http);
    this.evaluations = new AiAgentsEvaluationsClient(http);
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
    return this.threads.createAgentThreadMessage(
      projectUuid,
      agentUuid,
      threadUuid,
      body,
      options,
    );
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

  // ─── Project-scoped: evaluations ─────────────────────────────────────────────

  listEvaluations(
    projectUuid: string,
    agentUuid: string,
  ): Promise<AiAgentEvaluationSummary[]> {
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
  ): Promise<AiAgentEvaluationRunsListResponse> {
    return this.evaluations.listEvaluationRuns(projectUuid, agentUuid, evalUuid);
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
