# metrics Specification

## Purpose

Support for listing and retrieving metrics.

## Requirements

### Requirement: List project metrics

The system SHALL allow users to list all metrics available in a specific project.

#### Scenario: List metrics successfully

- **WHEN** user requests all metrics for project ID "123"
- **THEN** the system SHALL return a list of metric definitions

### Requirement: Retrieve metric details

The system SHALL allow users to retrieve detailed information for a specific metric.

#### Scenario: Get metric details

- **WHEN** user requests details for metric "my_metric" in table "my_table"
- **THEN** the system SHALL return the full metric metadata
