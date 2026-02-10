/**
 * Users (organization members) API client.
 */

import type { LightdashApi } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';
import { fetchAllPages } from '../../pagination/fetch-all-pages';

/** Query params for listing organization members. */
export interface ListMembersParams {
  includeGroups?: number;
  pageSize?: number;
  page?: number;
  searchQuery?: string;
  projectUuid?: string;
  googleOidcOnly?: boolean;
}

/** Params for listAllMembers (page and pageSize are controlled by the helper). */
export type ListAllMembersParams = Omit<ListMembersParams, 'page' | 'pageSize'>;

export class UsersClient extends BaseApiClient {
  /** List one page of members (use listAllMembers for all pages). */
  async listMembers(
    params?: ListMembersParams,
  ): Promise<LightdashApi.Users.OrganizationMemberProfilesResult> {
    return this.http.get<LightdashApi.Users.OrganizationMemberProfilesResult>('/org/users', {
      params,
    });
  }

  /** List all members of the current organization (fetches all pages). */
  async listAllMembers(
    params?: ListAllMembersParams,
    options?: { pageSize?: number },
  ): Promise<LightdashApi.Users.OrganizationMemberProfile[]> {
    return fetchAllPages<LightdashApi.Users.OrganizationMemberProfile>({
      fetchPage: (page, pageSize) =>
        this.http.get<LightdashApi.Users.OrganizationMemberProfilesResult>('/org/users', {
          params: { ...params, page, pageSize },
        }),
      pageSize: options?.pageSize,
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
