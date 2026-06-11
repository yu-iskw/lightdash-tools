/**
 * AI agent SQL approval client.
 * Endpoints: …/threads/{threadUuid}/tool-calls/{toolCallId}/sql-approval
 */

import { BaseApiClient } from '../../base-client';

import type { SubmitSqlApprovalBody, SubmitSqlApprovalResult } from '@lightdash-tools/common';

export class AiAgentsSqlApprovalClient extends BaseApiClient {
  /** Submit an approval decision for a pending SQL tool call (POST …/sql-approval). */
  async submitSqlApproval(
    projectUuid: string,
    agentUuid: string,
    threadUuid: string,
    toolCallId: string,
    body: SubmitSqlApprovalBody,
  ): Promise<SubmitSqlApprovalResult> {
    return this.http.post<SubmitSqlApprovalResult>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/threads/${threadUuid}/tool-calls/${toolCallId}/sql-approval`,
      body,
    );
  }
}
