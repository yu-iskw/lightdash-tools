/**
 * Lightdash API models entry point.
 * Consolidates v1 and v2 types while maintaining backward compatibility.
 */

import { LightdashApi as V1Api } from './v1/lightdash-api';
import { V2 as V2Api } from './v2/index';

// Re-export the unified namespace
export namespace LightdashApi {
  // Domain namespaces (legacy/v1 by default)
  export import Projects = V1Api.Projects;
  export import Organizations = V1Api.Organizations;
  export import Queries = V1Api.Queries;
  export import Charts = V1Api.Charts;
  export import Dashboards = V1Api.Dashboards;
  export import Spaces = V1Api.Spaces;
  export import SpaceAccess = V1Api.SpaceAccess;
  export import Users = V1Api.Users;
  export import Groups = V1Api.Groups;
  export import AiAgents = V1Api.AiAgents;
  export import ProjectAccess = V1Api.ProjectAccess;
  export import Explores = V1Api.Explores;
  export import Validation = V1Api.Validation;
  export import Metrics = V1Api.Metrics;
  export import Schedulers = V1Api.Schedulers;
  export import Tags = V1Api.Tags;
  export import Content = V1Api.Content;

  // Versioned namespaces
  export import V1 = V1Api.V1;
  export import V2 = V2Api;
}

// Flat exports for backward compatibility
export type {
  Project,
  OrganizationProject,
  Organization,
  SpaceQuery,
  ChartAsCodeListResults,
  ChartAsCodeUpsertResults,
  UpsertChartAsCodeBody,
  DashboardBasicDetailsWithTileTypes,
  SpaceSummary,
  Space,
  CreateSpace,
  UpdateSpace,
  AddSpaceUserAccess,
  AddSpaceGroupAccess,
  SpaceMemberRole,
  ProjectMemberProfile,
  ProjectMemberRole,
  CreateProjectMember,
  UpdateProjectMember,
  ProjectGroupAccess,
  CreateProjectGroupAccessBody,
  UpdateProjectGroupAccess,
  MetricQueryRequest,
  CompileQueryRequest,
  ExecuteAsyncMetricQueryRequestParams,
  ExecuteAsyncSqlQueryRequestParams,
  ExecuteAsyncSavedChartRequestParams,
  ExecuteAsyncDashboardChartRequestParams,
  ExecuteAsyncUnderlyingDataRequestParams,
  RunQueryResults,
  CompiledQueryResults,
  ExecuteAsyncMetricQueryResults,
  ExecuteAsyncDashboardChartResults,
  ExecuteAsyncSqlQueryResults,
  AiAgentSummary,
  AiAgentAdminSortField,
  AiAgentsAdminThreadsResult,
  GetAiOrganizationSettingsResult,
  UpdateAiOrganizationSettings,
  UpdateAiOrganizationSettingsResult,
  GetAdminThreadsParams,
  AiAgent,
  CreateAiAgent,
  UpdateAiAgent,
  AiAgentThreadSummary,
  AiAgentThread,
  CreateAgentThreadBody,
  GenerateAgentThreadBody,
  GenerateAgentThreadResult,
  CreateEvaluationPrompt,
  CreateEvaluationBody,
  CreateEvaluationResult,
  UpdateEvaluationBody,
  AppendEvaluationBody,
  AiAgentEvaluationSummary,
  AiAgentEvaluation,
  AiAgentEvaluationRunSummary,
  AiAgentEvaluationRun,
  AiAgentEvaluationRunResult,
  ApiExploresResults,
  ApiExploreResults,
} from './v1/lightdash-api';
