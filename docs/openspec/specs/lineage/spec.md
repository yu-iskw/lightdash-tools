# lineage Specification

## Purpose

Support for retrieving upstream/downstream lineage.

## Requirements

### Requirement: Get asset lineage

The system SHALL provide upstream and downstream lineage information for a given asset (e.g., a table or chart).

#### Scenario: Retrieve lineage successfully

- **WHEN** user requests lineage for table "users"
- **THEN** the system SHALL return a graph-like structure showing dependencies
