/**
 * V2 API type barrel. Re-exports the same surface as LightdashApi.V2.
 * Domain files remain at types/*.ts; see ADR-0008 (file layout follow-up).
 */

import type { Projects as P } from '../projects';
import type { Organizations as O } from '../organizations';
import type { Queries as Q } from '../queries';
import type { Charts as C } from '../charts';
import type { Dashboards as D } from '../dashboards';
import type { Spaces as S } from '../spaces';
import type { SpaceAccess as SA } from '../space-access';
import type { ProjectAccess as PA } from '../project-access';
import type { Users as U } from '../users';
import type { Groups as G } from '../groups';
import type { AiAgents as A } from '../ai-agents';

export namespace V2 {
  export namespace Projects {
    export type Project = P.Project;
    export type OrganizationProject = P.OrganizationProject;
  }

  export namespace Organizations {
    export type Organization = O.Organization;
  }

  export namespace Queries {
    export namespace Requests {
      export type MetricQuery = Q.Requests.MetricQuery;
      export type ExecuteAsyncMetricQuery = Q.Requests.ExecuteAsyncMetricQuery;
      export type ExecuteAsyncSqlQuery = Q.Requests.ExecuteAsyncSqlQuery;
      export type ExecuteAsyncSavedChart = Q.Requests.ExecuteAsyncSavedChart;
      export type ExecuteAsyncDashboardChart = Q.Requests.ExecuteAsyncDashboardChart;
      export type ExecuteAsyncUnderlyingData = Q.Requests.ExecuteAsyncUnderlyingData;
    }
    export namespace Responses {
      export type RunQueryResults = Q.Responses.RunQueryResults;
      export type ExecuteAsyncMetricQueryResults = Q.Responses.ExecuteAsyncMetricQueryResults;
      export type ExecuteAsyncDashboardChartResults = Q.Responses.ExecuteAsyncDashboardChartResults;
      export type ExecuteAsyncSqlQueryResults = Q.Responses.ExecuteAsyncSqlQueryResults;
    }
  }

  export namespace Charts {
    export type SpaceQuery = C.SpaceQuery;
  }

  export namespace Dashboards {
    export type DashboardBasicDetailsWithTileTypes = D.DashboardBasicDetailsWithTileTypes;
  }

  export namespace Spaces {
    export type SpaceSummary = S.SpaceSummary;
    export type Space = S.Space;
    export type CreateSpace = S.CreateSpace;
    export type UpdateSpace = S.UpdateSpace;
  }

  export namespace SpaceAccess {
    export type AddSpaceUserAccess = SA.AddSpaceUserAccess;
    export type AddSpaceGroupAccess = SA.AddSpaceGroupAccess;
    export type SpaceMemberRole = SA.SpaceMemberRole;
  }

  export namespace ProjectAccess {
    export type ProjectMemberProfile = PA.ProjectMemberProfile;
    export type ProjectMemberRole = PA.ProjectMemberRole;
    export type CreateProjectMember = PA.CreateProjectMember;
    export type UpdateProjectMember = PA.UpdateProjectMember;
    export type ProjectGroupAccess = PA.ProjectGroupAccess;
    export type CreateProjectGroupAccessBody = PA.CreateProjectGroupAccessBody;
    export type UpdateProjectGroupAccess = PA.UpdateProjectGroupAccess;
  }

  export namespace Users {
    export type OrganizationMemberProfile = U.OrganizationMemberProfile;
    export type OrganizationMemberProfilesResult = U.OrganizationMemberProfilesResult;
    export type ApiOrganizationMemberProfile = U.ApiOrganizationMemberProfile;
    export type ApiOrganizationMemberProfiles = U.ApiOrganizationMemberProfiles;
    export type OrganizationMemberProfileUpdate = U.OrganizationMemberProfileUpdate;
  }

  export namespace Groups {
    export type Group = G.Group;
    export type GroupWithMembers = G.GroupWithMembers;
    export type CreateGroup = G.CreateGroup;
    export type UpdateGroupWithMembers = G.UpdateGroupWithMembers;
    export type GroupListResult = G.GroupListResult;
    export type ApiGroupResponse = G.ApiGroupResponse;
    export type ApiGroupListResponse = G.ApiGroupListResponse;
    export type ApiCreateGroupResponse = G.ApiCreateGroupResponse;
    export type ApiGroupMembersResponse = G.ApiGroupMembersResponse;
    export type GroupMember = G.GroupMember;
  }

  export namespace AiAgents {
    export type AiAgentSummary = A.AiAgentSummary;
    export type AiAgentAdminSortField = A.AiAgentAdminSortField;
    export type AdminThreadsResult = A.AdminThreadsResult;
    export type GetAiOrganizationSettingsResult = A.GetAiOrganizationSettingsResult;
    export type UpdateAiOrganizationSettings = A.UpdateAiOrganizationSettings;
    export type UpdateAiOrganizationSettingsResult = A.UpdateAiOrganizationSettingsResult;
  }
}
