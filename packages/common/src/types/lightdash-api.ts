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

// Re-export domain namespaces
export type { Projects, Organizations, Queries, Charts, Dashboards, Spaces };

// Import generated types for LightdashApi namespace assembly
import type { components } from '@lightdash-ai/client/types/generated/openapi-types';

/**
 * Main namespace for all Lightdash API models.
 * Provides organized access to all domain models.
 *
 * Usage:
 * ```typescript
 * import type { LightdashApi } from '@lightdash-ai/common';
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
  }
}

// Flat exports for convenience (alternative to namespace access)
// These maintain backward compatibility with existing imports
export type Project = Projects.Project;
export type OrganizationProject = Projects.OrganizationProject;
export type Organization = Organizations.Organization;
export type SpaceQuery = Charts.SpaceQuery;
export type DashboardBasicDetailsWithTileTypes = Dashboards.DashboardBasicDetailsWithTileTypes;
export type SpaceSummary = Spaces.SpaceSummary;

// Query types (flat exports)
export type MetricQueryRequest = Queries.Requests.MetricQuery;
export type ExecuteAsyncMetricQueryRequestParams = Queries.Requests.ExecuteAsyncMetricQuery;
export type ExecuteAsyncSqlQueryRequestParams = Queries.Requests.ExecuteAsyncSqlQuery;
export type ExecuteAsyncSavedChartRequestParams = Queries.Requests.ExecuteAsyncSavedChart;
export type ExecuteAsyncDashboardChartRequestParams = Queries.Requests.ExecuteAsyncDashboardChart;
export type ExecuteAsyncUnderlyingDataRequestParams = Queries.Requests.ExecuteAsyncUnderlyingData;

export type RunQueryResults = Queries.Responses.RunQueryResults;
export type ExecuteAsyncMetricQueryResults = Queries.Responses.ExecuteAsyncMetricQueryResults;
export type ExecuteAsyncDashboardChartResults = Queries.Responses.ExecuteAsyncDashboardChartResults;
export type ExecuteAsyncSqlQueryResults = Queries.Responses.ExecuteAsyncSqlQueryResults;
