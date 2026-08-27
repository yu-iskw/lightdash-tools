/**
 * Project-scoped AI agent knowledge document client.
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/documents/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgentDocument,
  AiAgentDocumentContent,
  AiAgentDocumentSummary,
  CreateAgentDocumentBody,
  UpdateAgentDocumentContentBody,
  UpdateAgentDocumentSettingsBody,
} from '@lightdash-tools/common';

export class AiAgentsDocumentsClient extends BaseApiClient {
  /** List knowledge documents for an agent (GET …/documents). */
  async listDocuments(projectUuid: string, agentUuid: string): Promise<AiAgentDocumentSummary[]> {
    return this.http.get<AiAgentDocumentSummary[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents`,
    );
  }

  /** Read full document content (GET …/documents/{documentUuid}/content). */
  async getDocumentContent(
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
  ): Promise<AiAgentDocumentContent> {
    return this.http.get<AiAgentDocumentContent>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents/${documentUuid}/content`,
    );
  }

  /** Create a knowledge document scoped to this agent (POST …/documents). */
  async createDocument(
    projectUuid: string,
    agentUuid: string,
    body: CreateAgentDocumentBody,
  ): Promise<AiAgentDocument> {
    return this.http.post<AiAgentDocument>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents`,
      body,
    );
  }

  /** Replace document name and content (PATCH …/documents/{documentUuid}/content). */
  async updateDocumentContent(
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
    body: UpdateAgentDocumentContentBody,
  ): Promise<AiAgentDocument> {
    return this.http.patch<AiAgentDocument>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents/${documentUuid}/content`,
      body,
    );
  }

  /** Update document settings such as alwaysIncludeInContext (PATCH …/documents/{documentUuid}). */
  async updateDocumentSettings(
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
    body: UpdateAgentDocumentSettingsBody,
  ): Promise<void> {
    await this.http.patch(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents/${documentUuid}`,
      body,
    );
  }

  /** Delete a knowledge document (DELETE …/documents/{documentUuid}). */
  async deleteDocument(
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
  ): Promise<void> {
    await this.http.delete(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/documents/${documentUuid}`,
    );
  }
}
