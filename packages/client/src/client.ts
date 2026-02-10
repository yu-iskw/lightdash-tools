/**
 * Main Lightdash API client. Configuration can be explicit or loaded from environment variables.
 */

import type { PartialLightdashClientConfig } from './config';
import { mergeConfig } from './utils/env';
import { createAxiosInstanceV1, createAxiosInstanceV2 } from './http/axios-client';
import { RateLimiter } from './http/rate-limiter';
import { HttpClient } from './http/http-client';
import { ProjectsClient } from './api/projects';
import { OrganizationsClient } from './api/organizations';
import { ChartsClient } from './api/charts';
import { DashboardsClient } from './api/dashboards';
import { SpacesClient } from './api/spaces';
import { QueryClient } from './api/query';
import { QueryClientV2 } from './api/v2/query';
import { UsersClient } from './api/users';
import { GroupsClient } from './api/groups';
import { AiAgentsClient } from './api/ai-agents';

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
  }
}

/**
 * V2 API clients namespace. Contains v2-specific API clients.
 */
export class V2ApiClients {
  readonly query: QueryClientV2;

  constructor(http: HttpClient) {
    this.query = new QueryClientV2(http);
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

  /**
   * @deprecated Use `client.v1.projects` instead. This alias will be removed in a future major version.
   */
  readonly projects: ProjectsClient;
  /**
   * @deprecated Use `client.v1.organizations` instead. This alias will be removed in a future major version.
   */
  readonly organizations: OrganizationsClient;
  /**
   * @deprecated Use `client.v1.charts` instead. This alias will be removed in a future major version.
   */
  readonly charts: ChartsClient;
  /**
   * @deprecated Use `client.v1.dashboards` instead. This alias will be removed in a future major version.
   */
  readonly dashboards: DashboardsClient;
  /**
   * @deprecated Use `client.v1.spaces` instead. This alias will be removed in a future major version.
   */
  readonly spaces: SpacesClient;
  /**
   * @deprecated Use `client.v1.query` instead. This alias will be removed in a future major version.
   */
  readonly query: QueryClient;
  /**
   * @deprecated Use `client.v1.users` instead. This alias will be removed in a future major version.
   */
  readonly users: UsersClient;
  /**
   * @deprecated Use `client.v1.groups` instead. This alias will be removed in a future major version.
   */
  readonly groups: GroupsClient;
  /**
   * @deprecated Use `client.v1.aiAgents` instead. This alias will be removed in a future major version.
   */
  readonly aiAgents: AiAgentsClient;

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

    // Backward compatibility: deprecated aliases delegate to v1
    this.projects = this.v1.projects;
    this.organizations = this.v1.organizations;
    this.charts = this.v1.charts;
    this.dashboards = this.v1.dashboards;
    this.spaces = this.v1.spaces;
    this.query = this.v1.query;
    this.users = this.v1.users;
    this.groups = this.v1.groups;
    this.aiAgents = this.v1.aiAgents;
  }

  /**
   * Low-level HTTP client for custom v1 requests. Prefer domain methods (e.g. v1.projects, v1.charts) when available.
   * @deprecated Use `getHttpClientV1()` instead. This method will be removed in a future major version.
   */
  getHttpClient(): HttpClient {
    return this.httpV1;
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
