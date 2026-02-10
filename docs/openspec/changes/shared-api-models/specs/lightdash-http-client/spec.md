# Spec: Lightdash HTTP client (Modified)

## MODIFIED Requirements

### Requirement: Types aligned to Lightdash API

The client SHALL expose types that align with the Lightdash OpenAPI spec. Domain models (Project, Organization, etc.) SHALL be imported from `@lightdash-ai/common` instead of accessing them directly from generated OpenAPI types. Advanced types (`paths`, `components`, `operations`) SHALL remain available from the client package for advanced use cases.

#### Scenario: Client uses common types

- **WHEN** the client package imports domain models
- **THEN** it SHALL import from `@lightdash-ai/common` (e.g., `import type { Project } from '@lightdash-ai/common'`)

#### Scenario: Advanced types still available

- **WHEN** advanced use cases require access to `paths`, `components`, or `operations`
- **THEN** these SHALL remain available from `@lightdash-ai/client/types/api`

#### Scenario: Type safety maintained

- **WHEN** client methods use types from common
- **THEN** type safety SHALL be maintained (types remain identical to generated types)
