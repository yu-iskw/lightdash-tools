# Spec: Lightdash CLI

## ADDED Requirements

### Requirement: CLI package exists

The system SHALL provide a CLI package (`packages/cli`) that allows users to interact with the Lightdash API via command-line commands.

#### Scenario: CLI package exists

- **WHEN** the CLI package is examined
- **THEN** it SHALL be located at `packages/cli/`
- **AND** it SHALL have a `bin` entry in `package.json` for executable access

### Requirement: Organization command

The CLI SHALL support an `organization` command with a `get` subcommand that retrieves the current user's organization.

#### Scenario: Get organization

- **WHEN** user runs `lightdash-tools organization get`
- **THEN** the CLI SHALL call `client.v1.organizations.getCurrentOrganization()`
- **AND** it SHALL output the organization data (JSON or formatted)

#### Scenario: Organization command help

- **WHEN** user runs `lightdash-tools organization --help`
- **THEN** the CLI SHALL display help text for the organization command and its subcommands

### Requirement: Projects command

The CLI SHALL support a `projects` command with `get` and `list` subcommands.

#### Scenario: Get project

- **WHEN** user runs `lightdash-tools projects get <projectUuid>`
- **THEN** the CLI SHALL call `client.v1.projects.getProject(projectUuid)`
- **AND** it SHALL output the project data

#### Scenario: List projects

- **WHEN** user runs `lightdash-tools projects list`
- **THEN** the CLI SHALL call `client.v1.projects.listProjects()`
- **AND** it SHALL output the list of projects

#### Scenario: Projects command help

- **WHEN** user runs `lightdash-tools projects --help`
- **THEN** the CLI SHALL display help text for the projects command and its subcommands

### Requirement: Groups command

The CLI SHALL support a `groups` command with a `list` subcommand that lists groups in the organization.

#### Scenario: List groups

- **WHEN** user runs `lightdash-tools groups list`
- **THEN** the CLI SHALL call the HTTP client to get `/org/groups`
- **AND** it SHALL output the list of groups

#### Scenario: Groups command help

- **WHEN** user runs `lightdash-tools groups --help`
- **THEN** the CLI SHALL display help text for the groups command and its subcommands

### Requirement: Users command

The CLI SHALL support a `users` command with a `list` subcommand that lists users in the organization.

#### Scenario: List users

- **WHEN** user runs `lightdash-tools users list`
- **THEN** the CLI SHALL call the HTTP client to get `/org/users`
- **AND** it SHALL output the list of users

#### Scenario: Users command help

- **WHEN** user runs `lightdash-tools users --help`
- **THEN** the CLI SHALL display help text for the users command and its subcommands

### Requirement: Client initialization from environment variables

The CLI SHALL initialize the Lightdash client using environment variables `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`.

#### Scenario: Client uses environment variables

- **WHEN** the CLI initializes the client
- **THEN** it SHALL read `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` from environment
- **AND** it SHALL create a `LightdashClient` instance with these values

#### Scenario: Missing environment variables

- **WHEN** required environment variables are missing
- **THEN** the CLI SHALL display a helpful error message
- **AND** it SHALL suggest setting the environment variables

### Requirement: Error handling

The CLI SHALL handle errors gracefully and provide helpful error messages.

#### Scenario: API error

- **WHEN** an API call fails
- **THEN** the CLI SHALL catch the error
- **AND** it SHALL display a user-friendly error message
- **AND** it SHALL exit with a non-zero exit code

#### Scenario: Missing command arguments

- **WHEN** a required command argument is missing (e.g., projectUuid for `projects get`)
- **THEN** the CLI SHALL display an error message
- **AND** it SHALL show command usage/help

### Requirement: Output formatting

The CLI SHALL support output formatting options.

#### Scenario: JSON output

- **WHEN** user runs a command
- **THEN** the CLI SHALL output data in JSON format by default
- **OR** it SHALL support a `--json` flag for explicit JSON output

#### Scenario: Formatted output

- **WHEN** user runs a list command (e.g., `projects list`)
- **THEN** the CLI MAY support formatted table output (can be added in future)

### Requirement: Help documentation

All commands SHALL provide help documentation accessible via `--help` flag.

#### Scenario: Main help

- **WHEN** user runs `lightdash-tools --help`
- **THEN** the CLI SHALL display available commands and usage information

#### Scenario: Command help

- **WHEN** user runs `lightdash-tools <command> --help`
- **THEN** the CLI SHALL display help for that specific command and its subcommands
