/**
 * Users (organization members) API client.
 */

import type { LightdashApi } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

/** Query params for listing organization members. */
export interface ListMembersParams {
  includeGroups?: number;
  pageSize?: number;
  page?: number;
  searchQuery?: string;
  projectUuid?: string;
  googleOidcOnly?: boolean;
}

export class UsersClient extends BaseApiClient {
  /** List all members of the current organization. */
  async listMembers(
    params?: ListMembersParams,
  ): Promise<LightdashApi.Users.OrganizationMemberProfilesResult> {
    return this.http.get<LightdashApi.Users.OrganizationMemberProfilesResult>('/org/users', {
      params,
    });
  }

  /** Get organization member by UUID. */
  async getMemberByUuid(userUuid: string): Promise<LightdashApi.Users.OrganizationMemberProfile> {
    return this.http.get<LightdashApi.Users.OrganizationMemberProfile>(`/org/users/${userUuid}`);
  }

  /** Get organization member by email. */
  async getMemberByEmail(email: string): Promise<LightdashApi.Users.OrganizationMemberProfile> {
    return this.http.get<LightdashApi.Users.OrganizationMemberProfile>(
      `/org/users/email/${encodeURIComponent(email)}`,
    );
  }

  /**
   * Update organization member (e.g. role).
   * @deprecated This API is deprecated in Lightdash.
   */
  async updateMember(
    userUuid: string,
    body: LightdashApi.Users.OrganizationMemberProfileUpdate,
  ): Promise<LightdashApi.Users.OrganizationMemberProfile> {
    return this.http.patch<LightdashApi.Users.OrganizationMemberProfile>(
      `/org/users/${userUuid}`,
      body,
    );
  }

  /** Delete (remove) a user from the current organization. */
  async deleteMember(userUuid: string): Promise<void> {
    await this.http.delete(`/org/user/${userUuid}`);
  }
}
