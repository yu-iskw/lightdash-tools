/**
 * Spaces API client.
 */

import type {
  LightdashApi,
  SpaceSummary,
  CreateSpace,
  UpdateSpace,
  AddSpaceUserAccess,
  AddSpaceGroupAccess,
} from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

export class SpacesClient extends BaseApiClient {
  /** List spaces in a project. */
  async listSpacesInProject(projectUuid: string): Promise<SpaceSummary[]> {
    return this.http.get<SpaceSummary[]>(`/projects/${projectUuid}/spaces`);
  }

  /** Get a space by project and space UUID. */
  async getSpace(projectUuid: string, spaceUuid: string): Promise<LightdashApi.Spaces.Space> {
    return this.http.get<LightdashApi.Spaces.Space>(`/projects/${projectUuid}/spaces/${spaceUuid}`);
  }

  /** Create a space in a project. */
  async createSpace(projectUuid: string, body: CreateSpace): Promise<LightdashApi.Spaces.Space> {
    return this.http.post<LightdashApi.Spaces.Space>(`/projects/${projectUuid}/spaces`, body);
  }

  /** Update a space. */
  async updateSpace(
    projectUuid: string,
    spaceUuid: string,
    body: UpdateSpace,
  ): Promise<LightdashApi.Spaces.Space> {
    return this.http.patch<LightdashApi.Spaces.Space>(
      `/projects/${projectUuid}/spaces/${spaceUuid}`,
      body,
    );
  }

  /** Delete a space. */
  async deleteSpace(projectUuid: string, spaceUuid: string): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/spaces/${spaceUuid}`);
  }

  /** Grant a user access to a space. */
  async grantUserAccessToSpace(
    projectUuid: string,
    spaceUuid: string,
    body: AddSpaceUserAccess,
  ): Promise<void> {
    await this.http.post(`/projects/${projectUuid}/spaces/${spaceUuid}/share`, body);
  }

  /** Revoke a user's access to a space. */
  async revokeUserAccessToSpace(
    projectUuid: string,
    spaceUuid: string,
    userUuid: string,
  ): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/spaces/${spaceUuid}/share/${userUuid}`);
  }

  /** Grant a group access to a space. */
  async grantGroupAccessToSpace(
    projectUuid: string,
    spaceUuid: string,
    body: AddSpaceGroupAccess,
  ): Promise<void> {
    await this.http.post(`/projects/${projectUuid}/spaces/${spaceUuid}/group/share`, body);
  }

  /** Revoke a group's access to a space. */
  async revokeGroupAccessToSpace(
    projectUuid: string,
    spaceUuid: string,
    groupUuid: string,
  ): Promise<void> {
    await this.http.delete(`/projects/${projectUuid}/spaces/${spaceUuid}/group/share/${groupUuid}`);
  }
}
