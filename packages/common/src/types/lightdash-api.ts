/**
 * Lightdash API models extracted from OpenAPI specification.
 * These models are organized by domain for better discoverability and reuse across packages.
 *
 * Models are type aliases to generated OpenAPI types, ensuring they remain aligned with the spec.
 * Models are split into domain-specific files for better maintainability.
 */

// Import domain namespaces from domain files
import type { Projects } from './projects';
import type { Organizations } from './organizations';
import type { Queries } from './queries';
import type { Charts } from './charts';
import type { Dashboards } from './dashboards';
import type { Spaces } from './spaces';
import type { SpaceAccess } from './space-access';
import type { Users } from './users';
import type { Groups } from './groups';
import type { AiAgents } from './ai-agents';
import type { ProjectAccess } from './project-access';
import type { Explores } from './explores';

// Re-export domain namespaces
export type {
  Projects,
  Organizations,
  Queries,
  Charts,
  Dashboards,
  Spaces,
  SpaceAccess,
  Users,
  Groups,
  AiAgents,
  ProjectAccess,
  Explores,
};

// Import generated types for LightdashApi namespace assembly
import type { components } from './generated/openapi-types';

/**
 * Main namespace for all Lightdash API models.
 * Provides organized access to all domain models.
 *
 * Usage:
 * ```typescript
 * import type { LightdashApi } from '@lightdash-tools/common';
 * const project: LightdashApi.Projects.Project = ...;
 * ```
 */
export namespace LightdashApi {
  export namespace Projects {
    export type Project = components['schemas']['Project'];
    export type OrganizationProject = components['schemas']['OrganizationProject'];
  }

  export namespace Organizations {
    export type Organization = components['schemas']['Organization'];
  }

  export namespace Queries {
    export namespace Requests {
      export type MetricQuery = components['schemas']['MetricQueryRequest'];
      export type CompileQuery = components['schemas']['MetricQuery'] & {
        pivotConfiguration?: components['schemas']['PivotConfiguration'];
        parameters?: components['schemas']['ParametersValuesMap'];
      };
      export type ExecuteAsyncMetricQuery =
        components['schemas']['ExecuteAsyncMetricQueryRequestParams'];
      export type ExecuteAsyncSqlQuery = components['schemas']['ExecuteAsyncSqlQueryRequestParams'];
      export type ExecuteAsyncSavedChart =
        components['schemas']['ExecuteAsyncSavedChartRequestParams'];
      export type ExecuteAsyncDashboardChart =
        components['schemas']['ExecuteAsyncDashboardChartRequestParams'];
      export type ExecuteAsyncUnderlyingData =
        components['schemas']['ExecuteAsyncUnderlyingDataRequestParams'];
    }
    export namespace Responses {
      export type RunQueryResults = components['schemas']['ApiRunQueryResponse']['results'];
      export type CompiledQueryResults = components['schemas']['ApiCompiledQueryResults'];
      export type ExecuteAsyncMetricQueryResults =
        components['schemas']['ApiExecuteAsyncMetricQueryResults'];
      export type ExecuteAsyncDashboardChartResults =
        components['schemas']['ApiExecuteAsyncDashboardChartQueryResults'];
      export type ExecuteAsyncSqlQueryResults =
        components['schemas']['ApiExecuteAsyncSqlQueryResults'];
    }
  }

  export namespace Charts {
    export type SpaceQuery = components['schemas']['SpaceQuery'];
    export type ChartAsCodeListResults =
      components['schemas']['ApiChartAsCodeListResponse']['results'];
    export type ChartAsCodeUpsertResults =
      components['schemas']['ApiChartAsCodeUpsertResponse']['results'];
    export type UpsertChartAsCodeBody =
      components['schemas']['Omit_ChartAsCode.chartConfig-or-description_'] & {
        description?: string | null;
        chartConfig: components['schemas']['AnyType'];
        publicSpaceCreate?: boolean;
        skipSpaceCreate?: boolean;
      };
  }

  export namespace Dashboards {
    export type DashboardBasicDetailsWithTileTypes =
      components['schemas']['DashboardBasicDetailsWithTileTypes'];
  }

  export namespace Spaces {
    export type SpaceSummary = components['schemas']['SpaceSummary'];
    export type Space = components['schemas']['Space'];
    export type CreateSpace = components['schemas']['CreateSpace'];
    export type UpdateSpace = components['schemas']['UpdateSpace'];
  }

  export namespace SpaceAccess {
    export type AddSpaceUserAccess = components['schemas']['AddSpaceUserAccess'];
    export type AddSpaceGroupAccess = components['schemas']['AddSpaceGroupAccess'];
    export type SpaceMemberRole = components['schemas']['SpaceMemberRole'];
  }

  export namespace ProjectAccess {
    export type ProjectMemberProfile = components['schemas']['ProjectMemberProfile'];
    export type ProjectMemberRole = components['schemas']['ProjectMemberRole'];
    export type CreateProjectMember = components['schemas']['CreateProjectMember'];
    export type UpdateProjectMember = components['schemas']['UpdateProjectMember'];
    export type ProjectGroupAccess = components['schemas']['ProjectGroupAccess'];
    export type CreateProjectGroupAccessBody =
      components['schemas']['Pick_CreateProjectGroupAccess.role_'];
    export type UpdateProjectGroupAccess = components['schemas']['UpdateDBProjectGroupAccess'];
  }

  export namespace Users {
    export type OrganizationMemberProfile = components['schemas']['OrganizationMemberProfile'];
    export type OrganizationMemberProfilesResult =
      components['schemas']['KnexPaginatedData_OrganizationMemberProfile-Array_'];
    export type ApiOrganizationMemberProfile =
      components['schemas']['ApiOrganizationMemberProfile'];
    export type ApiOrganizationMemberProfiles =
      components['schemas']['ApiOrganizationMemberProfiles'];
    export type OrganizationMemberProfileUpdate =
      components['schemas']['OrganizationMemberProfileUpdate'];
  }

  export namespace Groups {
    export type Group = components['schemas']['Group'];
    export type GroupWithMembers = components['schemas']['GroupWithMembers'];
    export type CreateGroup = components['schemas']['CreateGroup'];
    export type UpdateGroupWithMembers = components['schemas']['UpdateGroupWithMembers'];
    export type GroupListResult =
      components['schemas']['KnexPaginatedData_Group-Array-or-GroupWithMembers-Array_'];
    export type ApiGroupResponse = components['schemas']['ApiGroupResponse'];
    export type ApiGroupListResponse = components['schemas']['ApiGroupListResponse'];
    export type ApiCreateGroupResponse = components['schemas']['ApiCreateGroupResponse'];
    export type ApiGroupMembersResponse = components['schemas']['ApiGroupMembersResponse'];
    export type GroupMember = components['schemas']['GroupMember'];
  }

  export namespace AiAgents {
    export type AiAgentSummary = components['schemas']['AiAgentSummary'];
    export type AiAgentAdminSortField = components['schemas']['AiAgentAdminSortField'];
    export type AdminThreadsResult =
      components['schemas']['ApiAiAgentAdminConversationsResponse']['results'];
    export type GetAiOrganizationSettingsResult =
      components['schemas']['ApiAiOrganizationSettingsResponse']['results'];
    export type UpdateAiOrganizationSettings =
      components['schemas']['UpdateAiOrganizationSettings'];
    export type UpdateAiOrganizationSettingsResult =
      components['schemas']['ApiUpdateAiOrganizationSettingsResponse']['results'];
  }

  export namespace Explores {
    export type ApiExploresResults = components['schemas']['ApiExploresResults'];
    export type ApiExploreResults = components['schemas']['ApiExploreResults'];
  }

  /** Types for Lightdash API v1 endpoints (ADR-0008). */
  export namespace V1 {
    export namespace Projects {
      export type Project = components['schemas']['Project'];
      export type OrganizationProject = components['schemas']['OrganizationProject'];
    }
    export namespace Organizations {
      export type Organization = components['schemas']['Organization'];
    }
    export namespace Queries {
      export namespace Requests {
        export type MetricQuery = components['schemas']['MetricQueryRequest'];
        export type CompileQuery = components['schemas']['MetricQuery'] & {
          pivotConfiguration?: components['schemas']['PivotConfiguration'];
          parameters?: components['schemas']['ParametersValuesMap'];
        };
        export type ExecuteAsyncMetricQuery =
          components['schemas']['ExecuteAsyncMetricQueryRequestParams'];
        export type ExecuteAsyncSqlQuery =
          components['schemas']['ExecuteAsyncSqlQueryRequestParams'];
        export type ExecuteAsyncSavedChart =
          components['schemas']['ExecuteAsyncSavedChartRequestParams'];
        export type ExecuteAsyncDashboardChart =
          components['schemas']['ExecuteAsyncDashboardChartRequestParams'];
        export type ExecuteAsyncUnderlyingData =
          components['schemas']['ExecuteAsyncUnderlyingDataRequestParams'];
      }
      export namespace Responses {
        export type RunQueryResults = components['schemas']['ApiRunQueryResponse']['results'];
        export type CompiledQueryResults = components['schemas']['ApiCompiledQueryResults'];
        export type ExecuteAsyncMetricQueryResults =
          components['schemas']['ApiExecuteAsyncMetricQueryResults'];
        export type ExecuteAsyncDashboardChartResults =
          components['schemas']['ApiExecuteAsyncDashboardChartQueryResults'];
        export type ExecuteAsyncSqlQueryResults =
          components['schemas']['ApiExecuteAsyncSqlQueryResults'];
      }
    }
    export namespace Charts {
      export type SpaceQuery = components['schemas']['SpaceQuery'];
    }
    export namespace Dashboards {
      export type DashboardBasicDetailsWithTileTypes =
        components['schemas']['DashboardBasicDetailsWithTileTypes'];
    }
    export namespace Spaces {
      export type SpaceSummary = components['schemas']['SpaceSummary'];
      export type Space = components['schemas']['Space'];
      export type CreateSpace = components['schemas']['CreateSpace'];
      export type UpdateSpace = components['schemas']['UpdateSpace'];
    }
    export namespace SpaceAccess {
      export type AddSpaceUserAccess = components['schemas']['AddSpaceUserAccess'];
      export type AddSpaceGroupAccess = components['schemas']['AddSpaceGroupAccess'];
      export type SpaceMemberRole = components['schemas']['SpaceMemberRole'];
    }
    export namespace ProjectAccess {
      export type ProjectMemberProfile = components['schemas']['ProjectMemberProfile'];
      export type ProjectMemberRole = components['schemas']['ProjectMemberRole'];
      export type CreateProjectMember = components['schemas']['CreateProjectMember'];
      export type UpdateProjectMember = components['schemas']['UpdateProjectMember'];
      export type ProjectGroupAccess = components['schemas']['ProjectGroupAccess'];
      export type CreateProjectGroupAccessBody =
        components['schemas']['Pick_CreateProjectGroupAccess.role_'];
      export type UpdateProjectGroupAccess = components['schemas']['UpdateDBProjectGroupAccess'];
    }
    export namespace Users {
      export type OrganizationMemberProfile = components['schemas']['OrganizationMemberProfile'];
      export type OrganizationMemberProfilesResult =
        components['schemas']['KnexPaginatedData_OrganizationMemberProfile-Array_'];
      export type ApiOrganizationMemberProfile =
        components['schemas']['ApiOrganizationMemberProfile'];
      export type ApiOrganizationMemberProfiles =
        components['schemas']['ApiOrganizationMemberProfiles'];
      export type OrganizationMemberProfileUpdate =
        components['schemas']['OrganizationMemberProfileUpdate'];
    }
    export namespace Groups {
      export type Group = components['schemas']['Group'];
      export type GroupWithMembers = components['schemas']['GroupWithMembers'];
      export type CreateGroup = components['schemas']['CreateGroup'];
      export type UpdateGroupWithMembers = components['schemas']['UpdateGroupWithMembers'];
      export type GroupListResult =
        components['schemas']['KnexPaginatedData_Group-Array-or-GroupWithMembers-Array_'];
      export type ApiGroupResponse = components['schemas']['ApiGroupResponse'];
      export type ApiGroupListResponse = components['schemas']['ApiGroupListResponse'];
      export type ApiCreateGroupResponse = components['schemas']['ApiCreateGroupResponse'];
      export type ApiGroupMembersResponse = components['schemas']['ApiGroupMembersResponse'];
      export type GroupMember = components['schemas']['GroupMember'];
    }
    export namespace AiAgents {
      export type AiAgentSummary = components['schemas']['AiAgentSummary'];
      export type AiAgentAdminSortField = components['schemas']['AiAgentAdminSortField'];
      export type AdminThreadsResult =
        components['schemas']['ApiAiAgentAdminConversationsResponse']['results'];
      export type GetAiOrganizationSettingsResult =
        components['schemas']['ApiAiOrganizationSettingsResponse']['results'];
      export type UpdateAiOrganizationSettings =
        components['schemas']['UpdateAiOrganizationSettings'];
      export type UpdateAiOrganizationSettingsResult =
        components['schemas']['ApiUpdateAiOrganizationSettingsResponse']['results'];
    }
  }

  /** Types for Lightdash API v2 endpoints (ADR-0008). */
  export namespace V2 {
    export namespace Projects {
      export type Project = components['schemas']['Project'];
      export type OrganizationProject = components['schemas']['OrganizationProject'];
    }
    export namespace Organizations {
      export type Organization = components['schemas']['Organization'];
    }
    export namespace Queries {
      export namespace Requests {
        export type MetricQuery = components['schemas']['MetricQueryRequest'];
        export type CompileQuery = components['schemas']['MetricQuery'] & {
          pivotConfiguration?: components['schemas']['PivotConfiguration'];
          parameters?: components['schemas']['ParametersValuesMap'];
        };
        export type ExecuteAsyncMetricQuery =
          components['schemas']['ExecuteAsyncMetricQueryRequestParams'];
        export type ExecuteAsyncSqlQuery =
          components['schemas']['ExecuteAsyncSqlQueryRequestParams'];
        export type ExecuteAsyncSavedChart =
          components['schemas']['ExecuteAsyncSavedChartRequestParams'];
        export type ExecuteAsyncDashboardChart =
          components['schemas']['ExecuteAsyncDashboardChartRequestParams'];
        export type ExecuteAsyncUnderlyingData =
          components['schemas']['ExecuteAsyncUnderlyingDataRequestParams'];
      }
      export namespace Responses {
        export type RunQueryResults = components['schemas']['ApiRunQueryResponse']['results'];
        export type CompiledQueryResults = components['schemas']['ApiCompiledQueryResults'];
        export type ExecuteAsyncMetricQueryResults =
          components['schemas']['ApiExecuteAsyncMetricQueryResults'];
        export type ExecuteAsyncDashboardChartResults =
          components['schemas']['ApiExecuteAsyncDashboardChartQueryResults'];
        export type ExecuteAsyncSqlQueryResults =
          components['schemas']['ApiExecuteAsyncSqlQueryResults'];
      }
    }
    export namespace Charts {
      export type SpaceQuery = components['schemas']['SpaceQuery'];
    }
    export namespace Dashboards {
      export type DashboardBasicDetailsWithTileTypes =
        components['schemas']['DashboardBasicDetailsWithTileTypes'];
    }
    export namespace Spaces {
      export type SpaceSummary = components['schemas']['SpaceSummary'];
      export type Space = components['schemas']['Space'];
      export type CreateSpace = components['schemas']['CreateSpace'];
      export type UpdateSpace = components['schemas']['UpdateSpace'];
    }
    export namespace SpaceAccess {
      export type AddSpaceUserAccess = components['schemas']['AddSpaceUserAccess'];
      export type AddSpaceGroupAccess = components['schemas']['AddSpaceGroupAccess'];
      export type SpaceMemberRole = components['schemas']['SpaceMemberRole'];
    }
    export namespace ProjectAccess {
      export type ProjectMemberProfile = components['schemas']['ProjectMemberProfile'];
      export type ProjectMemberRole = components['schemas']['ProjectMemberRole'];
      export type CreateProjectMember = components['schemas']['CreateProjectMember'];
      export type UpdateProjectMember = components['schemas']['UpdateProjectMember'];
      export type ProjectGroupAccess = components['schemas']['ProjectGroupAccess'];
      export type CreateProjectGroupAccessBody =
        components['schemas']['Pick_CreateProjectGroupAccess.role_'];
      export type UpdateProjectGroupAccess = components['schemas']['UpdateDBProjectGroupAccess'];
    }
    export namespace Users {
      export type OrganizationMemberProfile = components['schemas']['OrganizationMemberProfile'];
      export type OrganizationMemberProfilesResult =
        components['schemas']['KnexPaginatedData_OrganizationMemberProfile-Array_'];
      export type ApiOrganizationMemberProfile =
        components['schemas']['ApiOrganizationMemberProfile'];
      export type ApiOrganizationMemberProfiles =
        components['schemas']['ApiOrganizationMemberProfiles'];
      export type OrganizationMemberProfileUpdate =
        components['schemas']['OrganizationMemberProfileUpdate'];
    }
    export namespace Groups {
      export type Group = components['schemas']['Group'];
      export type GroupWithMembers = components['schemas']['GroupWithMembers'];
      export type CreateGroup = components['schemas']['CreateGroup'];
      export type UpdateGroupWithMembers = components['schemas']['UpdateGroupWithMembers'];
      export type GroupListResult =
        components['schemas']['KnexPaginatedData_Group-Array-or-GroupWithMembers-Array_'];
      export type ApiGroupResponse = components['schemas']['ApiGroupResponse'];
      export type ApiGroupListResponse = components['schemas']['ApiGroupListResponse'];
      export type ApiCreateGroupResponse = components['schemas']['ApiCreateGroupResponse'];
      export type ApiGroupMembersResponse = components['schemas']['ApiGroupMembersResponse'];
      export type GroupMember = components['schemas']['GroupMember'];
    }
    export namespace AiAgents {
      export type AiAgentSummary = components['schemas']['AiAgentSummary'];
      export type AiAgentAdminSortField = components['schemas']['AiAgentAdminSortField'];
      export type AdminThreadsResult =
        components['schemas']['ApiAiAgentAdminConversationsResponse']['results'];
      export type GetAiOrganizationSettingsResult =
        components['schemas']['ApiAiOrganizationSettingsResponse']['results'];
      export type UpdateAiOrganizationSettings =
        components['schemas']['UpdateAiOrganizationSettings'];
      export type UpdateAiOrganizationSettingsResult =
        components['schemas']['ApiUpdateAiOrganizationSettingsResponse']['results'];
    }
  }
}

// Flat exports for convenience (alternative to namespace access)
// These maintain backward compatibility with existing imports
export type Project = Projects.Project;
export type OrganizationProject = Projects.OrganizationProject;
export type Organization = Organizations.Organization;
export type SpaceQuery = Charts.SpaceQuery;
export type ChartAsCodeListResults = Charts.ChartAsCodeListResults;
export type ChartAsCodeUpsertResults = Charts.ChartAsCodeUpsertResults;
export type UpsertChartAsCodeBody = Charts.UpsertChartAsCodeBody;
export type DashboardBasicDetailsWithTileTypes = Dashboards.DashboardBasicDetailsWithTileTypes;
export type SpaceSummary = Spaces.SpaceSummary;
export type Space = Spaces.Space;
export type CreateSpace = Spaces.CreateSpace;
export type UpdateSpace = Spaces.UpdateSpace;
export type AddSpaceUserAccess = SpaceAccess.AddSpaceUserAccess;
export type AddSpaceGroupAccess = SpaceAccess.AddSpaceGroupAccess;
export type SpaceMemberRole = SpaceAccess.SpaceMemberRole;
export type ProjectMemberProfile = ProjectAccess.ProjectMemberProfile;
export type ProjectMemberRole = ProjectAccess.ProjectMemberRole;
export type CreateProjectMember = ProjectAccess.CreateProjectMember;
export type UpdateProjectMember = ProjectAccess.UpdateProjectMember;
export type ProjectGroupAccess = ProjectAccess.ProjectGroupAccess;
export type CreateProjectGroupAccessBody = ProjectAccess.CreateProjectGroupAccessBody;
export type UpdateProjectGroupAccess = ProjectAccess.UpdateProjectGroupAccess;

// Query types (flat exports)
export type MetricQueryRequest = Queries.Requests.MetricQuery;
export type CompileQueryRequest = Queries.Requests.CompileQuery;
export type ExecuteAsyncMetricQueryRequestParams = Queries.Requests.ExecuteAsyncMetricQuery;
export type ExecuteAsyncSqlQueryRequestParams = Queries.Requests.ExecuteAsyncSqlQuery;
export type ExecuteAsyncSavedChartRequestParams = Queries.Requests.ExecuteAsyncSavedChart;
export type ExecuteAsyncDashboardChartRequestParams = Queries.Requests.ExecuteAsyncDashboardChart;
export type ExecuteAsyncUnderlyingDataRequestParams = Queries.Requests.ExecuteAsyncUnderlyingData;

export type RunQueryResults = Queries.Responses.RunQueryResults;
export type CompiledQueryResults = Queries.Responses.CompiledQueryResults;
export type ExecuteAsyncMetricQueryResults = Queries.Responses.ExecuteAsyncMetricQueryResults;
export type ExecuteAsyncDashboardChartResults = Queries.Responses.ExecuteAsyncDashboardChartResults;
export type ExecuteAsyncSqlQueryResults = Queries.Responses.ExecuteAsyncSqlQueryResults;

// AI agents (flat exports)
export type AiAgentSummary = AiAgents.AiAgentSummary;
export type AiAgentAdminSortField = AiAgents.AiAgentAdminSortField;
export type AiAgentsAdminThreadsResult = AiAgents.AdminThreadsResult;
export type GetAiOrganizationSettingsResult = AiAgents.GetAiOrganizationSettingsResult;
export type UpdateAiOrganizationSettings = AiAgents.UpdateAiOrganizationSettings;
export type UpdateAiOrganizationSettingsResult = AiAgents.UpdateAiOrganizationSettingsResult;
export type GetAdminThreadsParams = AiAgents.GetAdminThreadsParams;

// Explores (flat exports)
export type ApiExploresResults = Explores.ApiExploresResults;
export type ApiExploreResults = Explores.ApiExploreResults;
