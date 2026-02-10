# Proposal: CLI parity with HTTP client (phased by domain)

## Why

The CLI (`packages/cli`) should offer the same capabilities as the client package (`packages/client`) so users can perform Lightdash operations from the command line without writing custom scripts. Today the CLI uses raw HTTP for `groups list` and `users list` even though `UsersClient` and `GroupsClient` exist; several client domains (v2 roles, project-access, spaces, charts, dashboards, query, ai-agents) have no CLI commands. Achieving parity improves user value, type safety, and maintainability (single pattern: typed clients only).

## What Changes

- **Phase 1**: Use only typed clients for domains the client covers. Refactor `groups list` and `users list` to `client.v1.groups.listGroups` and `client.v1.users.listMembers`; add CLI options for key params (e.g. `--page-size`, `--search`); optionally add `groups get <uuid>`, `users get <uuid>`; remove `getHttpClientV1()` usage for groups/users. Update the original lightdash-cli design doc to remove "Use HTTP client directly for Groups/Users."
- **Phase 2**: Add commands for v2 organization roles (list, get, assignments list, assign), project role assignments (list, assign/unassign user/group), project-access (list, list groups, get member), spaces (list, get). Defer create/update/delete and body-heavy operations.
- **Phase 3**: Add commands for charts (list), dashboards (list), ai-agents (list, threads, settings). Run-query is out of scope for Phase 3; will be considered later with `--file` for request body.

**NON-BREAKING**: Phase 1 is a refactor and additive subcommands; existing `groups list` and `users list` behavior is preserved or enhanced.

## Capabilities

### New Capabilities

- **cli-parity-with-client**: The CLI SHALL use typed clients from `@lightdash-ai/client` for every domain it exposes (no raw HTTP for groups/users). Phase 1 SHALL add optional `groups get` and `users get` subcommands and pass through list options (e.g. page-size, search) where the client supports them.

### Modified Capabilities

- **groups list** / **users list**: Implemented via `client.v1.groups.listGroups(params)` and `client.v1.users.listMembers(params)` with typed options instead of raw HTTP.

## Impact

- **Code**: Changes in `packages/cli/src/commands/groups.ts`, `packages/cli/src/commands/users.ts`; update `docs/openspec/changes/lightdash-cli/design.md` to remove raw HTTP decision.
- **User Experience**: Same or better CLI behavior; optional get subcommands and list options.
- **Developer Experience**: Single pattern (typed clients only); easier to add Phase 2/3 commands later.

## References

- ADR-0010: CLI parity with client package (phased by domain)
- GitHub Issue: #18
- OpenSpec (initial CLI): `docs/openspec/changes/lightdash-cli/`
