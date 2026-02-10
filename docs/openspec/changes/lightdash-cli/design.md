# Design: Lightdash CLI

## Context

Users need command-line access to Lightdash API operations. The CLI should be intuitive, well-documented, and easy to extend. We have an existing HTTP client package (`@lightdash-tools/client`) that handles authentication, rate limiting, and API calls.

Current state:

- HTTP client package exists with typed API methods
- No CLI interface
- Users must write custom scripts to interact with API

## Goals / Non-Goals

**Goals:**

- Provide convenient CLI access to common Lightdash API operations
- Support nested subcommands for intuitive command structure
- Use existing HTTP client package (no duplication)
- Support environment variable configuration
- Provide helpful error messages and documentation
- Easy to extend with new commands

**Non-Goals:**

- Interactive mode (can be added later)
- Configuration file support (can be added later)
- All API endpoints (start with common operations, extend incrementally)
- Authentication methods other than PAT (use existing client support)

## Decisions

### Decision 1: Use Commander.js

**Choice:** Use Commander.js library for command parsing and subcommand support.

**Rationale:**

- Mature, well-documented library with TypeScript support
- Excellent support for nested subcommands
- Built-in help generation
- Widely used in Node.js ecosystem
- Good performance and small footprint

**Alternatives Considered:**

- yargs: More complex, heavier
- oclif: More opinionated, larger dependency
- Custom parser: Too much work, reinventing the wheel

**Implementation:**

- Install `commander` package
- Use `Command` class for program and subcommands
- Register commands programmatically

### Decision 2: Single Entry Point with Programmatic Registration

**Choice:** Single entry point (`src/index.ts`) that programmatically registers all commands.

**Rationale:**

- Simpler testing and debugging (single process)
- Easier to understand control flow
- Better performance (no process spawning)
- Type-safe command registration

**Alternatives Considered:**

- File-based subcommands: More complex, harder to debug
- Command classes: More abstraction than needed

**Implementation:**

```typescript
// src/index.ts
import { Command } from 'commander';
import { registerOrganizationCommand } from './commands/organization';
// ... other imports

const program = new Command();
registerOrganizationCommand(program);
// ... register other commands
program.parse(process.argv);
```

### Decision 3: Modular Command Files

**Choice:** Each command area (organization, projects, groups, users) in separate files.

**Rationale:**

- Clear separation of concerns
- Easy to find and modify commands
- Scalable (easy to add new commands)
- Maintainable (each file is focused)

**Implementation:**

- `src/commands/organization.ts` - organization command
- `src/commands/projects.ts` - projects command
- `src/commands/groups.ts` - groups command
- `src/commands/users.ts` - users command

### Decision 4: Shared Client Utility

**Choice:** Shared utility function to initialize `LightdashClient` from environment variables.

**Rationale:**

- DRY (Don't Repeat Yourself)
- Consistent client initialization
- Centralized error handling for missing config
- Easy to extend with additional configuration options

**Implementation:**

```typescript
// src/utils/client.ts
import { LightdashClient } from '@lightdash-tools/client';

export function getClient(): LightdashClient {
  return new LightdashClient(); // Uses env vars automatically
}
```

### Decision 5: Use typed clients for groups and users

**Choice:** Use the typed clients `client.v1.groups` and `client.v1.users` for all groups and users operations. Do not use raw HTTP (`client.getHttpClientV1()`) for these domains.

**Rationale:**

- GroupsClient and UsersClient exist in the client package; the CLI uses them for type safety and a single source of truth.
- Aligns with ADR-0010 (CLI parity with client package, phased by domain) and OpenSpec change `cli-parity-with-client`.
- List commands support optional query params (e.g. `--page-size`, `--search`); get subcommands (`groups get <uuid>`, `users get <uuid>`) are available.

**Implementation:**

```typescript
// src/commands/groups.ts
const result = await client.v1.groups.listGroups(params);
// src/commands/users.ts
const result = await client.v1.users.listMembers(params);
```

## Risks / Trade-offs

### Risk: Groups/Users Implementation

**Issue:** (Resolved.) The CLI previously used raw HTTP for groups/users; it now uses typed clients only. See ADR-0010 and OpenSpec change `cli-parity-with-client`.

### Risk: Error Handling

**Issue:** Need to handle API errors gracefully and provide helpful messages.

**Mitigation:**

- Use try-catch blocks in command actions
- Format error messages clearly
- Provide suggestions for common errors (missing config, invalid credentials)

### Trade-off: Output Formatting

**Impact:** Starting with JSON output, formatted tables can be added later.

**Benefit:** Simpler initial implementation, can enhance based on user feedback.

## Migration Plan

### Phase 1: Setup

1. Create CLI package structure
2. Install dependencies (commander, @lightdash-tools/client, @lightdash-tools/common)
3. Create client utility

### Phase 2: Core Commands

1. Implement organization command
2. Implement projects command
3. Implement groups command
4. Implement users command

### Phase 3: Polish

1. Add output formatting
2. Add error handling
3. Add tests
4. Add documentation

## Open Questions

- Should we support configuration files? **Answer:** Not in initial version, can add later based on user feedback.
- Should we add interactive mode? **Answer:** Not in initial version, can add later if needed.
- Should we support output formats other than JSON? **Answer:** Start with JSON, add table formatting for lists.
