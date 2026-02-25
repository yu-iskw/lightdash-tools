/**
 * Main Lightdash API client. Configuration can be explicit or loaded from environment variables.
 */

import type { PartialLightdashClientConfig } from './config';
import { mergeConfig } from './utils/env';
import { createAxiosInstanceV1, createAxiosInstanceV2 } from './http/axios-client';
import { RateLimiter } from './http/rate-limiter';
import { HttpClient } from './http/http-client';
import { ProjectsClient } from './api/v1/projects';
import { OrganizationsClient } from './api/v1/organizations';
import { ChartsClient } from './api/v1/charts';
import { DashboardsClient } from './api/v1/dashboards';
import { SpacesClient } from './api/v1/spaces';
import { QueryClient } from './api/v1/query';
import { QueryClientV2 } from './api/v2/query';
import { OrganizationRolesClient } from './api/v2/organization-roles';
import { ProjectRoleAssignmentsClient } from './api/v2/project-role-assignments';
import { UsersClient } from './api/v1/users';
import { GroupsClient } from './api/v1/groups';
import { AiAgentsClient } from './api/v1/ai-agents';
import { ProjectAccessClient } from './api/v1/project-access';
import { ExploresClient } from './api/v1/explores';
import { ValidationClient } from './api/v1/validation';
import { MetricsClient } from './api/v1/metrics';
import { SchedulersClient } from './api/v1/schedulers';
import { TagsClient } from './api/v1/tags';
import { ContentClient } from './api/v2/content';

/**
 * V1 API clients namespace. Contains all v1 API clients.
 */
export class V1ApiClients {
  readonly projects: ProjectsClient;
  readonly organizations: OrganizationsClient;
  readonly charts: ChartsClient;
  readonly dashboards: DashboardsClient;
  readonly spaces: SpacesClient;
  readonly query: QueryClient;
  readonly users: UsersClient;
  readonly groups: GroupsClient;
  readonly aiAgents: AiAgentsClient;
  readonly projectAccess: ProjectAccessClient;
  readonly explores: ExploresClient;
  readonly validation: ValidationClient;
  readonly metrics: MetricsClient;
  readonly schedulers: SchedulersClient;
  readonly tags: TagsClient;

  constructor(http: HttpClient) {
    this.projects = new ProjectsClient(http);
    this.organizations = new OrganizationsClient(http);
    this.charts = new ChartsClient(http);
    this.dashboards = new DashboardsClient(http);
    this.spaces = new SpacesClient(http);
    this.query = new QueryClient(http);
    this.users = new UsersClient(http);
    this.groups = new GroupsClient(http);
    this.aiAgents = new AiAgentsClient(http);
    this.projectAccess = new ProjectAccessClient(http);
    this.explores = new ExploresClient(http);
    this.validation = new ValidationClient(http);
    this.metrics = new MetricsClient(http);
    this.schedulers = new SchedulersClient(http);
    this.tags = new TagsClient(http);
  }
}

/**
 * V2 API clients namespace. Contains v2-specific API clients.
 */
export class V2ApiClients {
  readonly query: QueryClientV2;
  readonly organizationRoles: OrganizationRolesClient;
  readonly projectRoleAssignments: ProjectRoleAssignmentsClient;
  readonly content: ContentClient;

  constructor(http: HttpClient) {
    this.query = new QueryClientV2(http);
    this.organizationRoles = new OrganizationRolesClient(http);
    this.projectRoleAssignments = new ProjectRoleAssignmentsClient(http);
    this.content = new ContentClient(http);
  }
}

/**
 * Lightdash HTTP client. Use environment variables (LIGHTDASH_URL, LIGHTDASH_API_KEY)
 * or pass a config object. Explicit config takes priority over env vars.
 *
 * @example
 * ```typescript
 * const client = new LightdashClient({ baseUrl: 'https://app.lightdash.cloud', personalAccessToken: 'token' });
 * // Use v1 namespace
 * const project = await client.v1.projects.getProject('project-uuid');
 * // Use v2 namespace (when available)
 * // const result = await client.v2.query.runMetricQuery(projectUuid, body);
 * ```
 */
export class LightdashClient {
  private readonly httpV1: HttpClient;
  private readonly httpV2: HttpClient;

  readonly v1: V1ApiClients;
  readonly v2: V2ApiClients;

  constructor(config?: PartialLightdashClientConfig) {
    const merged = mergeConfig(config);
    const rateLimiter = new RateLimiter(merged.rateLimit);

    // Create v1 HTTP client
    const axiosInstanceV1 = createAxiosInstanceV1(merged);
    this.httpV1 = new HttpClient(axiosInstanceV1, rateLimiter, merged);

    // Create v2 HTTP client
    const axiosInstanceV2 = createAxiosInstanceV2(merged);
    this.httpV2 = new HttpClient(axiosInstanceV2, rateLimiter, merged);

    // Create versioned namespaces
    this.v1 = new V1ApiClients(this.httpV1);
    this.v2 = new V2ApiClients(this.httpV2);
  }

  /**
   * Low-level HTTP client for custom v1 requests. Prefer domain methods (e.g. v1.projects, v1.charts) when available.
   */
  getHttpClientV1(): HttpClient {
    return this.httpV1;
  }

  /**
   * Low-level HTTP client for custom v2 requests. Prefer domain methods (e.g. v2.query) when available.
   */
  getHttpClientV2(): HttpClient {
    return this.httpV2;
  }
}
