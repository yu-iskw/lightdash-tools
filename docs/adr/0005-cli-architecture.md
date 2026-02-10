# 5. CLI Architecture Decision

Date: 2026-02-10

## Status

Accepted

Implements [10. CLI parity with client package (phased by domain)](0010-cli-parity-with-client-package-phased-by-domain.md)

## Context

We need a command-line interface (CLI) for Lightdash AI that allows users to interact with the Lightdash API without writing code. The CLI should support nested subcommands (e.g., `organization get`, `projects get`, `projects list`, `groups list`, `users list`) and use the existing HTTP client package (`@lightdash-tools/client`).

A problem-solving analysis evaluated 5 approaches:

1. Commander.js with Programmatic Command Registration (Single Entry Point) (91/100) - **selected**
2. Commander.js with File-Based Subcommands (Separate Executables) (63/100)
3. Commander.js with Modular Command Classes (90/100)
4. Alternative Framework (yargs or oclif) (80/100)
5. Minimal Custom Parser (58/100)

## Decision

We will implement **Approach 1: Commander.js with Programmatic Command Registration**.

### Implementation Details

- Use Commander.js library for command parsing and subcommand support
- Single entry point (`src/index.ts`) that programmatically registers all commands
- Modular command files in `src/commands/` directory for maintainability
- Shared client initialization utility that uses environment variables (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`)
- Commands use `@lightdash-tools/client` for API calls
- Support nested subcommands: `organization get`, `projects get/list`, `groups list`, `users list`

### Architecture

```
packages/cli/
├── src/
│   ├── index.ts              # Main entry, registers all commands
│   ├── commands/
│   │   ├── organization.ts   # organization command + get subcommand
│   │   ├── projects.ts       # projects command + get/list subcommands
│   │   ├── groups.ts         # groups command + list subcommand
│   │   └── users.ts          # users command + list subcommand
│   └── utils/
│       └── client.ts         # Shared client initialization
```

## Consequences

### Positive

- **Simplicity**: Single entry point simplifies testing and debugging
- **Maintainability**: Modular command files are easy to extend and maintain
- **Performance**: Single process, fast startup time
- **Type Safety**: Full TypeScript support with Commander.js types
- **Developer Experience**: Easy to add new commands, clear structure
- **Standard Library**: Commander.js is mature, well-documented, and widely used

### Negative

- **Dependency**: Adds `commander` as a runtime dependency
- **Initial Setup**: Requires command registration boilerplate

### Migration Strategy

1. Install `commander` dependency
2. Create command structure (commands/, utils/)
3. Implement each command module
4. Register commands in main entry point
5. Configure package.json bin entry
6. Add tests and documentation

## Future Considerations

- **Additional Commands**: Easy to add more commands (charts, dashboards, spaces, query) following the same pattern
- **Output Formatting**: Can add table formatting, JSON/YAML output options
- **Interactive Mode**: Can add interactive prompts using libraries like `inquirer`
- **Configuration Files**: Can add support for config files (e.g., `.lightdashrc`) for default settings
- **Groups/Users Clients**: When GroupsClient and UsersClient are added to the client package, CLI can be refactored to use them instead of HTTP client directly

## References

- Problem-solving analysis: See agent transcript
- OpenSpec: `docs/openspec/changes/lightdash-cli/`
- Commander.js: <https://www.npmjs.com/package/commander> <!-- markdown-link-check-disable-line -->
