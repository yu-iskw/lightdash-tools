/**
 * Project role assignments API client (v2). Manage project-level role assignments for users and groups.
 */

import type { components } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

type RoleAssignment = components['schemas']['RoleAssignment'];
type UpsertUserRoleAssignmentRequest = components['schemas']['UpsertUserRoleAssignmentRequest'];
type UpdateRoleAssignmentRequest = components['schemas']['UpdateRoleAssignmentRequest'];

export class ProjectRoleAssignmentsClient extends BaseApiClient {
  /** List project role assignments. */
  async listAssignments(projectId: string): Promise<RoleAssignment[]> {
    return this.http.get<RoleAssignment[]>(`/projects/${projectId}/roles/assignments`);
  }

  /** Create or update project role assignment for a user (upsert). */
  async upsertUserAssignment(
    projectId: string,
    userId: string,
    body: UpsertUserRoleAssignmentRequest,
  ): Promise<RoleAssignment> {
    return this.http.post<RoleAssignment>(
      `/projects/${projectId}/roles/assignments/user/${userId}`,
      body,
    );
  }

  /** Delete project role assignment for a user. */
  async deleteUserAssignment(projectId: string, userId: string): Promise<void> {
    await this.http.delete(`/projects/${projectId}/roles/assignments/user/${userId}`);
  }

  /** Create or update project role assignment for a group (upsert). */
  async upsertGroupAssignment(
    projectId: string,
    groupId: string,
    body: UpsertUserRoleAssignmentRequest,
  ): Promise<RoleAssignment> {
    return this.http.post<RoleAssignment>(
      `/projects/${projectId}/roles/assignments/group/${groupId}`,
      body,
    );
  }

  /** Delete project role assignment for a group. */
  async deleteGroupAssignment(projectId: string, groupId: string): Promise<void> {
    await this.http.delete(`/projects/${projectId}/roles/assignments/group/${groupId}`);
  }

  /** Update project role assignment for a group. */
  async updateGroupAssignment(
    projectId: string,
    groupId: string,
    body: UpdateRoleAssignmentRequest,
  ): Promise<RoleAssignment> {
    return this.http.patch<RoleAssignment>(
      `/projects/${projectId}/roles/assignments/group/${groupId}`,
      body,
    );
  }
}
