# Proposal: Support Space Access Management in CLI and MCP

## Why

Space access management is a key administrative task in Lightdash. Currently, users must use the UI or direct API calls to manage who can access which spaces. By adding this to the CLI and MCP, we enable:

- Automated onboarding/offboarding of users to spaces.
- AI-assisted permission management.
- Command-line workflows for space administration.

## What Changes

- **Client**: Add `SpaceAccessClient` (v1) to `@lightdash-tools/client`.
- **CLI**: Add `projects space-access` command group with `user` and `group` subcommands for `grant` and `revoke`.
- **MCP**: Add `grant_user_space_access`, `revoke_user_space_access`, `grant_group_space_access`, and `revoke_group_space_access` tools.

## Capabilities

### New Capabilities

- **CLI**: `projects space-access user grant/revoke` and `projects space-access group grant/revoke`.
- **MCP**: Tools for space access management.

## Impact

- **Code**:
  - `packages/client/src/api/v1/space-access.ts`
  - `packages/cli/src/commands/space-access.ts`
  - `packages/mcp/src/tools/space-access.ts`
- **User Experience**: Streamlined space administration.

## References

- ADR-0030: Support Space Access Management
- GitHub Issue: [#98](https://github.com/yu-iskw/lightdash-tools/issues/98)
