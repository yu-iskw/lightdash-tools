# Spec: Shared API Models (Modified)

## MODIFIED Requirements

### Requirement: Domain models extracted to common package

The system SHALL extract Lightdash API domain models from generated OpenAPI types to `packages/common/src/types/`. Models SHALL be organized by domain namespace (Projects, Organizations, Queries, Charts, Dashboards, Spaces). Models SHALL be split into separate domain files (`projects.ts`, `organizations.ts`, `queries.ts`, etc.) for better maintainability. The main `lightdash-api.ts` file SHALL import domains and assemble the `LightdashApi` namespace.

#### Scenario: Models available in common package

- **WHEN** a package imports from `@lightdash-tools/common`
- **THEN** domain models (Project, Organization, etc.) SHALL be accessible

#### Scenario: Models organized by domain files

- **WHEN** models are accessed from `@lightdash-tools/common`
- **THEN** models SHALL be organized into domain files, with each domain in its own file

#### Scenario: Main file assembles namespace

- **WHEN** `LightdashApi` namespace is accessed
- **THEN** it SHALL be assembled from domain files by the main `lightdash-api.ts` file
