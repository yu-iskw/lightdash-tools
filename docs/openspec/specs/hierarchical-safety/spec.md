# Spec: Hierarchical Safety

## Purpose

To provide a unified, hierarchical safety model that restricts operations based on their risk level, ensuring that AI agents and tools operate within safe boundaries.

## Requirements

### Requirement: Hierarchical safety modes definition

The system SHALL define three hierarchical safety modes:

1. `read-only`: Only allow read-only operations.
2. `write-idempotent`: Allow read-only operations and non-destructive, idempotent writes.
3. `write-destructive`: Allow all operations.

#### Scenario: Mode comparison

- **WHEN** a required mode is compared against the current mode
- **THEN** it SHALL be allowed if the current mode is at least as permissive as the required mode
- **AND** the hierarchy order SHALL be `read-only` < `write-idempotent` < `write-destructive`

### Requirement: Safety validation logic

The system SHALL provide a unified validation function that takes a tool's annotations and the current safety mode, and returns whether the operation is allowed.

#### Scenario: Read-only mode enforcement

- **WHEN** the current mode is `read-only`
- **THEN** only tools with `readOnlyHint: true` SHALL be allowed

#### Scenario: Write-idempotent mode enforcement

- **WHEN** the current mode is `write-idempotent`
- **THEN** tools with `readOnlyHint: true` SHALL be allowed
- **AND** tools with `readOnlyHint: false` AND `destructiveHint: false` SHALL be allowed
- **AND** tools with `destructiveHint: true` SHALL NOT be allowed

#### Scenario: Write-destructive mode enforcement

- **WHEN** the current mode is `write-destructive`
- **THEN** all tools SHALL be allowed regardless of annotations

### Requirement: Global configuration

The current safety mode SHALL be configurable via environment variable `LIGHTDASH_TOOL_SAFETY_MODE` and SHALL default to `write-destructive`.

#### Scenario: Environment variable configuration

- **WHEN** `LIGHTDASH_TOOL_SAFETY_MODE` is set to a valid mode
- **THEN** the system SHALL use that mode as the default current mode

#### Scenario: Default mode

- **WHEN** `LIGHTDASH_TOOL_SAFETY_MODE` is NOT set
- **THEN** the system SHALL default to `write-destructive`
