/**
 * Project-scoped AI agent thread client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads/...
 */

import { BaseApiClient } from '../../base-client';

import { toAxiosConfig } from './request-options';

import type { RequestOptions } from './request-options';
import type {
  AiAgentThread,
  AiAgentThreadSummary,
  CloneThreadBody,
  CreateAgentThreadBody,
  CreateAgentThreadMessageResult,
  GenerateAgentThreadBody,
  GenerateAgentThreadResult,
  GenerateThreadTitleResult,
} from '@lightdash-tools/common';

/** Thread metadata for {@link startConversation}; the user prompt is sent via the message body. */
export type StartConversationThreadBody = Omit<CreateAgentThreadBody, 'prompt'>;

function toCreateThreadBody(
  threadBody: StartConversationThreadBody | undefined,
): CreateAgentThreadBody | undefined {
  if (threadBody === undefined) {
    return undefined;
  }
  const body: CreateAgentThreadBody = { ...threadBody };
  delete body.prompt;
  return body;
}

export class AiAgentsThreadsClient extends BaseApiClient {
  private postJson<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
    const axiosConfig = toAxiosConfig(options);
    if (options?.retry === undefined) {
      return this.http.post<T>(url, body, axiosConfig);
    }
    return this.http.post<T>(url, body, axiosConfig, options.retry);
  }

  private getJson<T>(url: string, options?: RequestOptions): Promise<T> {
    const axiosConfig = toAxiosConfig(options);
    if (options?.retry === undefined) {
      return this.http.get<T>(url, axiosConfig);
    }
    return this.http.get<T>(url, axiosConfig, options.retry);
  }

  /** List all threads for an agent (GET /projects/{projectUuid}/aiAgents/{agentUuid}/threads). */
  async listAgentThreads(projectUuid: string, agentUuid: string): Promise<AiAgentThreadSummary[]> {
    return this.http.get<AiAgentThreadSummary[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads`,
    );
  }

  /**
   * Create a new thread (POST /projects/{projectUuid}/aiAgents/{agentUuid}/threads).
   * Does not send a prompt; use {@link createAgentThreadMessage} and
   * {@link generateAgentThreadResponse} for the RFC conversation flow.
   */
  async createAgentThread(
    projectUuid: string,
    agentUuid: string,
    body?: CreateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<AiAgentThreadSummary> {
    return this.postJson<AiAgentThreadSummary>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads`,
      body ?? {},
      options,
    );
  }

  /** Get a thread with its messages (GET …/threads/{threadUuid}). */
  async getAgentThread(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<AiAgentThread> {
    return this.getJson<AiAgentThread>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}`,
      options,
    );
  }

  /**
   * Add a user message to a thread
   * (POST …/threads/{threadUuid}/messages).
   */
  async createAgentThreadMessage(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<CreateAgentThreadMessageResult> {
    return this.postJson<CreateAgentThreadMessageResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/messages`,
      body,
      options,
    );
  }

  /**
   * Trigger agent generation for the latest pending user message
   * (POST …/threads/{threadUuid}/generate). Sends no request body.
   */
  async generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult>;

  /**
   * @deprecated Pass the prompt via {@link createAgentThreadMessage} first. When `body` is
   * provided, creates the message then calls generate for backward compatibility.
   */
  async generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult>;

  async generateAgentThreadResponse(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    bodyOrOptions?: GenerateAgentThreadBody | RequestOptions,
    maybeOptions?: RequestOptions,
  ): Promise<GenerateAgentThreadResult> {
    const hasPromptBody =
      bodyOrOptions !== undefined && typeof bodyOrOptions === 'object' && 'prompt' in bodyOrOptions;

    if (hasPromptBody) {
      const body = bodyOrOptions as GenerateAgentThreadBody;
      const options = maybeOptions;
      await this.createAgentThreadMessage(projectUuid, agentUuid, threadUuid, body, options);
      return this.generateAgentThreadResponse(projectUuid, agentUuid, threadUuid, options);
    }

    const options = (hasPromptBody ? maybeOptions : bodyOrOptions) as RequestOptions | undefined;
    return this.postJson<GenerateAgentThreadResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/generate`,
      undefined,
      options,
    );
  }

  /**
   * Start a new conversation: create thread → add user message → generate response.
   */
  async startConversation(
    projectUuid: string,
    agentUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions & { threadBody?: StartConversationThreadBody },
  ): Promise<{ thread: AiAgentThreadSummary; result: GenerateAgentThreadResult }> {
    const { threadBody, ...requestOptions } = options ?? {};
    const thread = await this.createAgentThread(
      projectUuid,
      agentUuid,
      toCreateThreadBody(threadBody),
      requestOptions,
    );
    await this.createAgentThreadMessage(projectUuid, agentUuid, thread.uuid, body, requestOptions);
    const result = await this.generateAgentThreadResponse(
      projectUuid,
      agentUuid,
      thread.uuid,
      requestOptions,
    );
    return { thread, result };
  }

  /**
   * Continue an existing conversation: add user message → generate response.
   */
  async continueConversation(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body: GenerateAgentThreadBody,
    options?: RequestOptions,
  ): Promise<GenerateAgentThreadResult> {
    await this.createAgentThreadMessage(projectUuid, agentUuid, threadUuid, body, options);
    return this.generateAgentThreadResponse(projectUuid, agentUuid, threadUuid, options);
  }

  /** Generate a title for a thread (POST …/threads/{threadUuid}/generate-title). */
  async generateThreadTitle(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    options?: RequestOptions,
  ): Promise<GenerateThreadTitleResult> {
    return this.postJson<GenerateThreadTitleResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/generate-title`,
      undefined,
      options,
    );
  }

  /**
   * Clone a thread from an existing prompt
   * (POST …/threads/{threadUuid}/clone/{promptUuid}).
   */
  async cloneThread(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    body?: CloneThreadBody,
  ): Promise<AiAgentThreadSummary> {
    const promptUuid = body?.promptUuid;
    if (!promptUuid) {
      throw new Error('cloneThread requires body.promptUuid');
    }

    return this.http.post<AiAgentThreadSummary>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/clone/${promptUuid}`,
      undefined,
      body.createdFrom === undefined ? undefined : { params: { createdFrom: body.createdFrom } },
    );
  }
}
