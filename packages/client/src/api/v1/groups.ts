/**
 * Groups API client.
 */

import type { LightdashApi } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

/** Query params for listing organization groups. */
export interface ListGroupsParams {
  page?: number;
  pageSize?: number;
  includeMembers?: number;
  searchQuery?: string;
}

/** Query params for getGroup. */
export interface GetGroupParams {
  includeMembers?: number;
  offset?: number;
}

export class GroupsClient extends BaseApiClient {
  /** List all groups in the current organization. */
  async listGroups(params?: ListGroupsParams): Promise<LightdashApi.Groups.GroupListResult> {
    return this.http.get<LightdashApi.Groups.GroupListResult>('/org/groups', {
      params,
    });
  }

  /** Create a new group in the current organization. */
  async createGroup(
    body: LightdashApi.Groups.CreateGroup,
  ): Promise<LightdashApi.Groups.GroupWithMembers> {
    return this.http.post<LightdashApi.Groups.GroupWithMembers>('/org/groups', body);
  }

  /** Get a group by UUID. */
  async getGroup(
    groupUuid: string,
    params?: GetGroupParams,
  ): Promise<LightdashApi.Groups.Group | LightdashApi.Groups.GroupWithMembers> {
    return this.http.get<LightdashApi.Groups.Group | LightdashApi.Groups.GroupWithMembers>(
      `/groups/${groupUuid}`,
      { params },
    );
  }

  /** Update a group (name and/or members). */
  async updateGroup(
    groupUuid: string,
    body: LightdashApi.Groups.UpdateGroupWithMembers,
  ): Promise<LightdashApi.Groups.Group | LightdashApi.Groups.GroupWithMembers> {
    return this.http.patch<LightdashApi.Groups.Group | LightdashApi.Groups.GroupWithMembers>(
      `/groups/${groupUuid}`,
      body,
    );
  }

  /** Delete a group. */
  async deleteGroup(groupUuid: string): Promise<void> {
    await this.http.delete(`/groups/${groupUuid}`);
  }

  /** Get members of a group. */
  async getGroupMembers(groupUuid: string): Promise<LightdashApi.Groups.GroupMember[]> {
    return this.http.get<LightdashApi.Groups.GroupMember[]>(`/groups/${groupUuid}/members`);
  }

  /** Add a user to a group. */
  async addUserToGroup(groupUuid: string, userUuid: string): Promise<void> {
    await this.http.put(`/groups/${groupUuid}/members/${userUuid}`);
  }

  /** Remove a user from a group. */
  async removeUserFromGroup(groupUuid: string, userUuid: string): Promise<void> {
    await this.http.delete(`/groups/${groupUuid}/members/${userUuid}`);
  }
}
