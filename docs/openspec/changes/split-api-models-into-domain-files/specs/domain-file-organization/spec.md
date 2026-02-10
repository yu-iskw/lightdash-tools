# Spec: Domain File Organization

## ADDED Requirements

### Requirement: Models split into domain files

Models SHALL be split into separate domain-specific files. Each domain file SHALL be self-contained and export its namespace. Domain files SHALL be organized by domain (Projects, Organizations, Queries, Charts, Dashboards, Spaces).

#### Scenario: Projects domain file exists

- **WHEN** models are organized
- **THEN** `packages/common/src/types/projects.ts` SHALL exist and export the `Projects` namespace

#### Scenario: Each domain has its own file

- **WHEN** models are organized
- **THEN** each domain (Projects, Organizations, Queries, Charts, Dashboards, Spaces) SHALL have its own file in `packages/common/src/types/`

#### Scenario: Domain files are self-contained

- **WHEN** a domain file is examined
- **THEN** it SHALL import only from generated types and export its namespace without dependencies on other domain files

### Requirement: Main file assembles namespace

The main `lightdash-api.ts` file SHALL import all domain namespaces and assemble the `LightdashApi` namespace. The main file SHALL provide flat exports for backward compatibility.

#### Scenario: Main file imports domains

- **WHEN** `lightdash-api.ts` is examined
- **THEN** it SHALL import all domain namespaces from domain files

#### Scenario: LightdashApi namespace assembled

- **WHEN** `LightdashApi` namespace is accessed
- **THEN** it SHALL contain all domain namespaces (Projects, Organizations, Queries, etc.)

#### Scenario: Flat exports available

- **WHEN** flat exports are used (e.g., `import type { Project } from '@lightdash-ai/common'`)
- **THEN** they SHALL continue to work (backward compatible)
