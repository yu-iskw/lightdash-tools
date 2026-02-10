# Spec: Shared API Models

## ADDED Requirements

### Requirement: Domain models extracted to common package

The system SHALL extract Lightdash API domain models from generated OpenAPI types to `packages/common/src/types/lightdash-api.ts`. Models SHALL be organized by domain namespace (Projects, Organizations, Queries, Charts, Dashboards, Spaces).

#### Scenario: Models available in common package

- **WHEN** a package imports from `@lightdash-ai/common`
- **THEN** domain models (Project, Organization, etc.) SHALL be accessible

#### Scenario: Models organized by domain

- **WHEN** models are accessed from `@lightdash-ai/common`
- **THEN** models SHALL be organized into domain namespaces (Projects, Organizations, Queries, etc.)

### Requirement: Type aliases align with OpenAPI spec

Extracted models SHALL be type aliases to the generated OpenAPI types, ensuring they remain aligned with the OpenAPI specification. Models SHALL NOT redefine types but SHALL reference `components['schemas']` from generated types.

#### Scenario: Type alignment maintained

- **WHEN** a model is extracted (e.g., `Project`)
- **THEN** it SHALL be a type alias: `export type Project = components['schemas']['Project']`

#### Scenario: Type compatibility

- **WHEN** a model from common is used in place of a generated type
- **THEN** TypeScript SHALL treat them as identical types (no type errors)

### Requirement: Cross-package type reuse

Other packages (`cli`, `mcp`) SHALL be able to import types from `@lightdash-ai/common` without requiring a dependency on `@lightdash-ai/client`.

#### Scenario: CLI package imports types

- **WHEN** `packages/cli` imports types from `@lightdash-ai/common`
- **THEN** it SHALL be able to use domain models without depending on client package

#### Scenario: MCP package imports types

- **WHEN** `packages/mcp` imports types from `@lightdash-ai/common`
- **THEN** it SHALL be able to use domain models without depending on client package

### Requirement: Models exported from common index

All models SHALL be exported from `packages/common/src/index.ts` to enable convenient imports. Models MAY be exported both as individual types and as organized namespaces.

#### Scenario: Direct type import

- **WHEN** a package imports `import type { Project } from '@lightdash-ai/common'`
- **THEN** the Project type SHALL be available

#### Scenario: Namespace import

- **WHEN** a package imports `import type { LightdashApi } from '@lightdash-ai/common'`
- **THEN** models SHALL be accessible via `LightdashApi.Projects.Project`
