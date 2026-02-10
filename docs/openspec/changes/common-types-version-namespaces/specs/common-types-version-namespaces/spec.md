# Spec: Common package type namespaces by API version

## ADDED Requirements

### Requirement: LightdashApi.V1 namespace

The common package SHALL expose a top-level namespace `LightdashApi.V1` that re-exports only the domain types used by or associated with the Lightdash API v1 endpoints.

#### Scenario: V1 namespace exists

- **WHEN** a consumer imports from `@lightdash-ai/common` and accesses `LightdashApi.V1`
- **THEN** the type namespace SHALL be defined and SHALL contain domain sub-namespaces or types (e.g. Queries, Projects) whose types are used by v1 API paths

#### Scenario: V1 query types

- **WHEN** a consumer uses types for v1 query endpoints (e.g. runQuery, metric query request/response)
- **THEN** those types SHALL be available under `LightdashApi.V1.Queries` (e.g. Requests.MetricQuery, Responses.RunQueryResults)

### Requirement: LightdashApi.V2 namespace

The common package SHALL expose a top-level namespace `LightdashApi.V2` that re-exports only the domain types used by or associated with the Lightdash API v2 endpoints.

#### Scenario: V2 namespace exists

- **WHEN** a consumer imports from `@lightdash-ai/common` and accesses `LightdashApi.V2`
- **THEN** the type namespace SHALL be defined and SHALL contain domain sub-namespaces or types whose types are used by v2 API paths

#### Scenario: V2 query types

- **WHEN** a consumer uses types for v2 query endpoints (e.g. execute async metric query, chart query, dashboard chart query)
- **THEN** those types SHALL be available under `LightdashApi.V2.Queries` (e.g. Requests.ExecuteAsyncMetricQuery, Responses.ExecuteAsyncMetricQueryResults)

### Requirement: Backward compatibility for unversioned namespace and flat exports

The common package SHALL retain the existing unversioned `LightdashApi` domain namespaces (e.g. `LightdashApi.Projects`, `LightdashApi.Queries`) and all existing flat exports (e.g. `MetricQueryRequest`, `RunQueryResults`) so that existing consumers do not require code changes.

#### Scenario: Unversioned namespace still available

- **WHEN** a consumer imports `LightdashApi.Projects` or `LightdashApi.Queries` from `@lightdash-ai/common`
- **THEN** those namespaces SHALL remain defined and SHALL resolve to the same types as before the change

#### Scenario: Flat exports still available

- **WHEN** a consumer imports a flat export (e.g. `MetricQueryRequest`, `ExecuteAsyncMetricQueryRequestParams`) from `@lightdash-ai/common`
- **THEN** those exports SHALL remain defined and SHALL resolve to the same types as before the change
