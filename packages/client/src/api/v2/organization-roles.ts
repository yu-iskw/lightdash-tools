/**
 * Organization roles API client (v2). Manage org-level roles and role assignments.
 */

import type { components } from '@lightdash-ai/common';
import { BaseApiClient } from '../base-client';

type CreateRole = components['schemas']['CreateRole'];
type UpdateRole = components['schemas']['UpdateRole'];
type AddScopesToRole = components['schemas']['AddScopesToRole'];
type Role = components['schemas']['Role'];
type RoleWithScopes = components['schemas']['RoleWithScopes'];
type RoleAssignment = components['schemas']['RoleAssignment'];

/** Response shape for getRoles (array of Role or RoleWithScopes). */
export type GetRolesResult = Role[] | RoleWithScopes[];

/** Query params for getRoles. */
export interface GetRolesParams {
  load?: string;
  roleTypeFilter?: string;
}

/** Request body for assigning an org role to a user. */
export interface AssignOrgRoleToUserBody {
  roleId: string;
}

export class OrganizationRolesClient extends BaseApiClient {
  /** Get roles for an organization. */
  async getRoles(orgUuid: string, params?: GetRolesParams): Promise<GetRolesResult> {
    return this.http.get<GetRolesResult>(`/orgs/${orgUuid}/roles`, {
      params,
    });
  }

  /** Create a custom role in the organization. */
  async createRole(orgUuid: string, body: CreateRole): Promise<Role> {
    return this.http.post<Role>(`/orgs/${orgUuid}/roles`, body);
  }

  /** Get a custom role by UUID. */
  async getRole(orgUuid: string, roleUuid: string): Promise<RoleWithScopes> {
    return this.http.get<RoleWithScopes>(`/orgs/${orgUuid}/roles/${roleUuid}`);
  }

  /** Update a custom role. */
  async updateRole(orgUuid: string, roleUuid: string, body: UpdateRole): Promise<Role> {
    return this.http.patch<Role>(`/orgs/${orgUuid}/roles/${roleUuid}`, body);
  }

  /** Delete a custom role from the organization. */
  async deleteRole(orgUuid: string, roleUuid: string): Promise<void> {
    await this.http.delete(`/orgs/${orgUuid}/roles/${roleUuid}`);
  }

  /** Add scopes to a role. */
  async addScopesToRole(orgUuid: string, roleUuid: string, body: AddScopesToRole): Promise<void> {
    await this.http.post(`/orgs/${orgUuid}/roles/${roleUuid}/scopes`, body);
  }

  /** Remove a scope from a role. */
  async removeScopeFromRole(orgUuid: string, roleUuid: string, scopeName: string): Promise<void> {
    await this.http.delete(
      `/orgs/${orgUuid}/roles/${roleUuid}/scopes/${encodeURIComponent(scopeName)}`,
    );
  }

  /** Duplicate a role. */
  async duplicateRole(orgUuid: string, roleId: string, body: CreateRole): Promise<RoleWithScopes> {
    return this.http.post<RoleWithScopes>(`/orgs/${orgUuid}/roles/${roleId}/duplicate`, body);
  }

  /** List organization role assignments (system roles only). */
  async listRoleAssignments(orgUuid: string): Promise<RoleAssignment[]> {
    return this.http.get<RoleAssignment[]>(`/orgs/${orgUuid}/roles/assignments`);
  }

  /** Assign an organization role to a user. */
  async assignRoleToUser(
    orgUuid: string,
    userId: string,
    body: AssignOrgRoleToUserBody,
  ): Promise<RoleAssignment> {
    return this.http.post<RoleAssignment>(
      `/orgs/${orgUuid}/roles/assignments/user/${userId}`,
      body,
    );
  }
}
