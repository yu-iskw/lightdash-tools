# Spec: Validation

## ADDED Requirements

### Requirement: Trigger project validation

The system SHALL provide a way to trigger a full content validation for a specific project.

#### Scenario: Trigger validation successfully

- **WHEN** user requests a validation run for project ID "123"
- **THEN** the system SHALL start the validation process and return the job status

### Requirement: List validation errors

The system SHALL provide a way to retrieve the list of current validation errors for a project.

#### Scenario: List errors successfully

- **WHEN** user requests the validation results for project ID "123"
- **THEN** the system SHALL return a list of validation error objects including location, message, and type
