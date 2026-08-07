/**
 * Projects API client. Endpoints for project and project-scoped resources.
 */

import { BaseApiClient } from '../base-client';

import type { Project, OrganizationProject, SpaceQuery, components } from '@lightdash-tools/common';

/** Results of GET projects/{projectUuid}/content-verification (verified charts + dashboards). */
export type VerifiedContentListItem = components['schemas']['VerifiedContentListItem'];

export class ProjectsClient extends BaseApiClient {
  /** Get a project by UUID. */
  async getProject(projectUuid: string): Promise<Project> {
    return this.http.get<Project>(`/projects/${projectUuid}`);
  }

  /** List all projects in the current organization. */
  async listProjects(): Promise<OrganizationProject[]> {
    return this.http.get<OrganizationProject[]>('/org/projects');
  }

  /** List charts in a project. */
  async listChartsInProject(projectUuid: string): Promise<SpaceQuery[]> {
    return this.http.get<SpaceQuery[]>(`/projects/${projectUuid}/charts`);
  }

  /** List admin-verified charts and dashboards in a project. */
  async listVerifiedContent(projectUuid: string): Promise<VerifiedContentListItem[]> {
    return this.http.get<VerifiedContentListItem[]>(
      `/projects/${projectUuid}/content-verification`,
    );
  }
}
