# @lightdash-tools/common

Shared utilities and types for Lightdash AI packages.

## Installation

```bash
pnpm add @lightdash-tools/common
```

## Lightdash API Models

This package provides shared Lightdash API request/response models extracted from the OpenAPI specification. Models are organized by domain for better discoverability and can be used across packages without requiring a dependency on the client package.

Domain models are type aliases to generated OpenAPI types (using `openapi-typescript`), ensuring they remain aligned with the Lightdash API specification. Types are automatically updated when the OpenAPI spec changes.

Models are split into domain-specific files for better maintainability:

- `types/projects.ts` - Projects domain models
- `types/organizations.ts` - Organizations domain models
- `types/queries.ts` - Queries domain models (requests and responses)
- `types/charts.ts` - Charts domain models
- `types/dashboards.ts` - Dashboards domain models
- `types/spaces.ts` - Spaces domain models

The main `types/lightdash-api.ts` file imports all domains and assembles the `LightdashApi` namespace, providing flat exports for backward compatibility. All existing imports continue to work without changes.

### Usage

#### Flat Imports (Recommended)

```typescript
import type { Project, Organization, SpaceQuery } from '@lightdash-tools/common';

const project: Project = ...;
const org: Organization = ...;
```

#### Namespace Imports

```typescript
import type { LightdashApi } from '@lightdash-tools/common';

const project: LightdashApi.Projects.Project = ...;
const org: LightdashApi.Organizations.Organization = ...;
const query: LightdashApi.Queries.Requests.MetricQuery = ...;
```

### Available Models

#### Projects Domain

- `Project` - Project entity
- `OrganizationProject` - Organization project listing item

#### Organizations Domain

- `Organization` - Organization entity

#### Queries Domain

**Requests:**

- `MetricQueryRequest` - V1 metric query request
- `ExecuteAsyncMetricQueryRequestParams` - V2 async metric query request
- `ExecuteAsyncSqlQueryRequestParams` - V2 async SQL query request
- `ExecuteAsyncSavedChartRequestParams` - V2 async saved chart query request
- `ExecuteAsyncDashboardChartRequestParams` - V2 async dashboard chart query request
- `ExecuteAsyncUnderlyingDataRequestParams` - V2 async underlying data query request

**Responses:**

- `RunQueryResults` - V1 query response results
- `ExecuteAsyncMetricQueryResults` - V2 async metric query results
- `ExecuteAsyncDashboardChartResults` - V2 async dashboard chart query results
- `ExecuteAsyncSqlQueryResults` - V2 async SQL query results

#### Charts Domain

- `SpaceQuery` - Space query (chart listing item)

#### Dashboards Domain

- `DashboardBasicDetailsWithTileTypes` - Dashboard basic details with tile types

#### Spaces Domain

- `SpaceSummary` - Space summary

### Example: Using Models in CLI Package

```typescript
import type { Project, Organization } from '@lightdash-tools/common';

function displayProject(project: Project) {
  console.log(`Project: ${project.name}`);
  console.log(`UUID: ${project.projectUuid}`);
}

function displayOrganization(org: Organization) {
  console.log(`Organization: ${org.name}`);
  console.log(`UUID: ${org.organizationUuid}`);
}
```

### Example: Using Models in MCP Package

```typescript
import type { LightdashApi } from '@lightdash-tools/common';

type Project = LightdashApi.Projects.Project;
type QueryRequest = LightdashApi.Queries.Requests.MetricQuery;
```

## Type Safety

Models are type aliases to generated OpenAPI types, ensuring they remain aligned with the Lightdash API specification. Types are automatically updated when the OpenAPI spec changes.

## License

Apache-2.0
