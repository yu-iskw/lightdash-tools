# group-management Specification

## Purpose

Provide full CRUD and membership management for Lightdash groups in CLI and MCP, ensuring parity with the `GroupsClient` in `@lightdash-tools/client`.

## Requirements

### Requirement: Create a group

The system SHALL allow users to create a new group in the organization.

#### Scenario: Create group successfully

- **WHEN** the user provides a group name
- **THEN** the system SHALL create the group and return its details (UUID, name)

### Requirement: Update a group

The system SHALL allow users to update an existing group's name.

#### Scenario: Update group name successfully

- **WHEN** the user provides a group UUID and a new name
- **THEN** the system SHALL update the group and return its updated details

### Requirement: Delete a group

The system SHALL allow users to delete an existing group.

#### Scenario: Delete group successfully

- **WHEN** the user provides a group UUID
- **THEN** the system SHALL delete the group

### Requirement: List group members

The system SHALL allow users to list all users who are members of a specific group.

#### Scenario: List group members successfully

- **WHEN** the user provides a group UUID
- **THEN** the system SHALL return a list of users (UUID, name, email) in that group

### Requirement: Add user to group

The system SHALL allow users to add a user to a group.

#### Scenario: Add user to group successfully

- **WHEN** the user provides a group UUID and a user UUID
- **THEN** the system SHALL add the user to the group

### Requirement: Remove user from group

The system SHALL allow users to remove a user from a group.

#### Scenario: Remove user from group successfully

- **WHEN** the user provides a group UUID and a user UUID
- **THEN** the system SHALL remove the user from the group
