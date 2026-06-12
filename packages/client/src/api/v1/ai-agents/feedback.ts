/**
 * AI agent message feedback client.
 * Endpoints: …/threads/{threadUuid}/messages/{messageUuid}/feedback
 */

import { BaseApiClient } from '../../base-client';

import type { UpdateMessageFeedbackBody } from '@lightdash-tools/common';

export class AiAgentsFeedbackClient extends BaseApiClient {
  /** Update human feedback on an assistant message (PATCH …/messages/{messageUuid}/feedback). */
  async updateMessageFeedback(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    messageUuid: string,
    body: UpdateMessageFeedbackBody,
  ): Promise<void> {
    await this.http.patch<void>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/messages/${messageUuid}/feedback`,
      body,
    );
  }
}
