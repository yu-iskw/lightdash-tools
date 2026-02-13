# Spec: Schedulers

## ADDED Requirements

### Requirement: List project schedulers

The system SHALL allow users to list all active schedulers (scheduled deliveries) in a project.

#### Scenario: List schedulers successfully

- **WHEN** user requests all schedulers for project ID "123"
- **THEN** the system SHALL return a list of scheduler objects

### Requirement: Get scheduler logs

The system SHALL allow users to retrieve execution logs for a specific scheduler.

#### Scenario: Get logs successfully

- **WHEN** user requests logs for scheduler ID "abc"
- **THEN** the system SHALL return a list of recent execution attempts and their status
