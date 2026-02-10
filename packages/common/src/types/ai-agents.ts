/**
 * AI agents domain models.
 * Extracted from OpenAPI specification for better maintainability.
 */

import type { components } from './generated/openapi-types';

export namespace AiAgents {
  /** Summary of an AI agent (admin list). */
  export type AiAgentSummary = components['schemas']['AiAgentSummary'];
  /** Sort field for admin thread list. */
  export type AiAgentAdminSortField = components['schemas']['AiAgentAdminSortField'];
  /** Paginated result for admin threads (API response results). */
  export type AdminThreadsResult =
    components['schemas']['ApiAiAgentAdminConversationsResponse']['results'];
  /** Query params for listing admin threads (getAllThreads). */
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
  /** AI organization settings (get response). */
  export type AiOrganizationSettings = components['schemas']['AiOrganizationSettings'];
  /** Computed AI org settings (included in get response). */
  export type ComputedAiOrganizationSettings =
    components['schemas']['ComputedAiOrganizationSettings'];
  /** Get AI org settings response results (settings + computed). */
  export type GetAiOrganizationSettingsResult =
    components['schemas']['ApiAiOrganizationSettingsResponse']['results'];
  /** Update AI org settings request body. */
  export type UpdateAiOrganizationSettings = components['schemas']['UpdateAiOrganizationSettings'];
  /** Update AI org settings response results. */
  export type UpdateAiOrganizationSettingsResult =
    components['schemas']['ApiUpdateAiOrganizationSettingsResponse']['results'];
}
