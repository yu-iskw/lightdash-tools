# Tasks: Explores API in client, CLI, and MCP

## Phase 1: HTTP client (packages/client)

- [ ] 1.1 Add `packages/client/src/api/v1/explores.ts`: `ExploresClient` with `listExplores(projectUuid)` and `getExplore(projectUuid, exploreId)`. Use GET paths `/projects/{projectUuid}/explores` and `/projects/{projectUuid}/explores/{exploreId}`. Use types from common/openapi (ApiExploresResults, ApiExploreResults or equivalent).
- [ ] 1.2 In `packages/client/src/client.ts`, add `ExploresClient` to `V1ApiClients`, instantiate in constructor, expose `client.v1.explores`. Add deprecated top-level alias `client.explores` if the project uses that pattern.
- [ ] 1.3 Add `packages/client/src/api/v1/explores.test.ts`: tests that assert listExplores and getExplore call the correct path and method (mock HTTP). Follow query.test.ts or spaces.test.ts pattern.
- [ ] 1.4 Run `pnpm build` from repo root; fix any type errors.

## Phase 2: CLI (packages/cli)

- [ ] 2.1 Add `packages/cli/src/commands/explores.ts`: find projects command, add `explores` subcommand group with `list <projectUuid>` and `get <projectUuid> <exploreId>`. Call `client.v1.explores.listExplores` and `getExplore`; output JSON.
- [ ] 2.2 In `packages/cli/src/index.ts`, import and call `registerExploresCommand(program)` after `registerProjectsCommand`.
- [ ] 2.3 Add or extend CLI tests for `projects explores list` and `projects explores get` registration and client usage.
- [ ] 2.4 Run `pnpm build`, `pnpm test`, `pnpm lint`.

## Phase 3: MCP (packages/mcp)

- [ ] 3.1 Add `packages/mcp/src/tools/explores.ts`: register `list_explores` (input projectUuid) and `get_explore` (inputs projectUuid, exploreId). Use wrapTool and registerToolSafe; call client.v1.explores and return JSON text.
- [ ] 3.2 In `packages/mcp/src/tools/index.ts`, import `registerExploresTools` and call `registerExploresTools(server, client)` in `registerTools`.
- [ ] 3.3 Run `pnpm build`, `pnpm test`, `pnpm lint`.

## Phase 4: Changelog (after Phases 1–3 complete)

- [ ] 4.1 Add changelog fragments (feat) for client, CLI, and MCP using manage-changelog. Then batch release / merge into CHANGELOG per the skill.
