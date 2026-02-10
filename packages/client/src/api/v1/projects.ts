/**
 * Projects API client. Endpoints for project and project-scoped resources.
 */

import type { Project, OrganizationProject, SpaceQuery } from '@lightdash-tools/common';
import { BaseApiClient } from '../base-client';

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
}
