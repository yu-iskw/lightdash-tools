/**
 * Project access API client (project-level user and group access).
 */

import type { LightdashApi } from '@lightdash-ai/common';
import { BaseApiClient } from './base-client';

export class ProjectAccessClient extends BaseApiClient {
  /** List users with explicit project access. */
  async listProjectAccess(
    projectUuid: string,
  ): Promise<LightdashApi.ProjectAccess.ProjectMemberProfile[]> {
    return this.http.get<LightdashApi.ProjectAccess.ProjectMemberProfile[]>(
      `/projects/${projectUuid}/access`,
    );
  }

  /** Grant a user access to a project. */
  async grantProjectAccessToUser(
    projectUuid: string,
    body: LightdashApi.ProjectAccess.CreateProjectMember,
  ): Promise<void> {
    await this.http.post(`/projects/${projectUuid}/access`, body);
  }

  /** Get a project member's access. */
  async getProjectMemberAccess(
    projectUuid: string,
    userUuid: string,
  ): Promise<LightdashApi.ProjectAccess.ProjectMemberProfile> {
    return this.http.get<LightdashApi.ProjectAccess.ProjectMemberProfile>(
      `/projects/${projectUuid}/user/${userUuid}`,
    );
  }

  /**
   * Update a user's project access (role).
   * @deprecated This API is deprecated in Lightdash.
   */
  async updateProjectAccessForUser(
    projectUuid: string,
    userUuid: string,
    body: LightdashApi.ProjectAccess.UpdateProjectMember,
  ): Promise<void> {
    await this.http.patch(`/projects/${projectUuid}/access/${userUuid}`, body);
  }

  /**
   * Revoke a user's project access.
   * @deprecated This API is deprecated in Lightdash.
   */
  async revokeProjectAccessForUser(projectUuid: string, userUuid: string): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/access/${userUuid}`);
  }

  /** List group access for a project. */
  async listProjectGroupAccesses(
    projectUuid: string,
  ): Promise<LightdashApi.ProjectAccess.ProjectGroupAccess[]> {
    return this.http.get<LightdashApi.ProjectAccess.ProjectGroupAccess[]>(
      `/projects/${projectUuid}/groupAccesses`,
    );
  }

  /**
   * Add project access to a group.
   * @deprecated This API is deprecated in Lightdash.
   */
  async addProjectAccessToGroup(
    groupUuid: string,
    projectUuid: string,
    body: LightdashApi.ProjectAccess.CreateProjectGroupAccessBody,
  ): Promise<LightdashApi.ProjectAccess.ProjectGroupAccess> {
    return this.http.post<LightdashApi.ProjectAccess.ProjectGroupAccess>(
      `/groups/${groupUuid}/projects/${projectUuid}`,
      body,
    );
  }

  /**
   * Remove project access from a group.
   * @deprecated This API is deprecated in Lightdash.
   */
  async removeProjectAccessFromGroup(groupUuid: string, projectUuid: string): Promise<void> {
    await this.http.delete(`/groups/${groupUuid}/projects/${projectUuid}`);
  }

  /**
   * Update a group's project access (role).
   * @deprecated This API is deprecated in Lightdash.
   */
  async updateProjectAccessForGroup(
    groupUuid: string,
    projectUuid: string,
    body: LightdashApi.ProjectAccess.UpdateProjectGroupAccess,
  ): Promise<LightdashApi.ProjectAccess.ProjectGroupAccess> {
    return this.http.patch<LightdashApi.ProjectAccess.ProjectGroupAccess>(
      `/groups/${groupUuid}/projects/${projectUuid}`,
      body,
    );
  }
}
