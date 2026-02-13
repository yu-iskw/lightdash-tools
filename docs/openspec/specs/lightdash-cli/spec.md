# Spec: Lightdash CLI

## Purpose

The Command Line Interface for lightdash-tools, providing a human-friendly way to interact with the Lightdash API.

## Requirements

### Requirement: Global mode flag

The CLI SHALL support a global `--mode` flag to override the default safety mode.

#### Scenario: Global mode flag override

- **WHEN** user runs `lightdash-tools --mode <mode> <command>`
- **THEN** the CLI SHALL use the specified `<mode>` for the duration of the command execution

### Requirement: Hierarchical safety enforcement in CLI

The CLI SHALL audit all commands and enforce the current hierarchical safety mode before executing a command's action.

#### Scenario: Command execution in restricted mode

- **WHEN** a command is executed
- **AND** the command's safety level is NOT compatible with the current safety mode
- **THEN** the CLI SHALL display an error message
- **AND** it SHALL exit with a non-zero exit code without executing the command's action
