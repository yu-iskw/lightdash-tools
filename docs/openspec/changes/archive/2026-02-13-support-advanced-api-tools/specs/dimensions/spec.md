# Spec: Dimensions

## ADDED Requirements

### Requirement: List project dimensions

The system SHALL allow users to list all dimensions available in a specific project.

#### Scenario: List dimensions successfully

- **WHEN** user requests all dimensions for project ID "123"
- **THEN** the system SHALL return a list of dimension definitions

### Requirement: Retrieve dimension details

The system SHALL allow users to retrieve detailed information for a specific dimension.

#### Scenario: Get dimension details

- **WHEN** user requests details for dimension "my_dim" in table "my_table"
- **THEN** the system SHALL return the full dimension metadata
