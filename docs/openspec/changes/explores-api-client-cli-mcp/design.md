# Design: Explores API in client, CLI, and MCP

## Context

- The Lightdash v1 API exposes `GET /api/v1/projects/{projectUuid}/explores` (list) and `GET /api/v1/projects/{projectUuid}/explores/{exploreId}` (get). Response types are `ApiExploresResults` (array of summary explore) and `ApiExploreResults` (single full explore) in the OpenAPI-generated types.
- The client package has v1 domain clients (projects, spaces, charts, query, etc.) under `client.v1.*`. Spaces and charts are exposed under the CLI as `projects spaces list/get` and `projects charts list`.
- The MCP server registers tools per domain (projects, spaces, charts, query, etc.) and uses `client.v1.*` to call the API.

## Goals / Non-Goals

**Goals:**

- Add ExploresClient with listExplores and getExplore; wire into V1ApiClients and optional deprecated top-level alias.
- Add CLI commands under projects: `projects explores list <projectUuid>`, `projects explores get <projectUuid> <exploreId>`.
- Add MCP tools: `list_explores` (projectUuid), `get_explore` (projectUuid, exploreId).

**Non-Goals:**

- Set explores (PUT), download CSV, get explore file (git). Document as future work in ADR/OpenSpec.

## Decisions

### Decision 1: Client

**Choice:** New `ExploresClient` in `packages/client/src/api/v1/explores.ts` with:

- `listExplores(projectUuid: string)` → GET `/projects/{projectUuid}/explores`, return type from OpenAPI (ApiExploresResults or equivalent).
- `getExplore(projectUuid: string, exploreId: string)` → GET `/projects/{projectUuid}/explores/{exploreId}`, return type ApiExploreResults or equivalent.

Types: use existing generated types from `packages/common` (openapi-types or lightdash-api Explores namespace if added). Wire in `client.ts`: add to V1ApiClients, instantiate in constructor; add deprecated `client.explores` alias to match other v1 domains.

**Rationale:** Same pattern as SpacesClient, ChartsClient; single source of truth for paths and types.

### Decision 2: CLI

**Choice:** New module `packages/cli/src/commands/explores.ts`. Find the existing `projects` command via `program.commands.find((c) => c.name() === 'projects')`, then add `projectsCmd.command('explores')` with subcommands:

- `list <projectUuid>`: call `client.v1.explores.listExplores(projectUuid)`, output `JSON.stringify(result, null, 2)`.
- `get <projectUuid> <exploreId>`: call `client.v1.explores.getExplore(projectUuid, exploreId)`, output JSON.

Register `registerExploresCommand(program)` in `index.ts` after `registerProjectsCommand`.

**Rationale:** Matches spaces and charts; keeps explores under projects hierarchy.

### Decision 3: MCP

**Choice:** New module `packages/mcp/src/tools/explores.ts`. Register two tools:

- `list_explores`: input schema `{ projectUuid: z.string() }`; call `client.v1.explores.listExplores(projectUuid)`; return content as JSON text.
- `get_explore`: input schema `{ projectUuid: z.string(), exploreId: z.string() }`; call `client.v1.explores.getExplore(projectUuid, exploreId)`; return content as JSON text.

Use existing `wrapTool` and `registerToolSafe` from shared. Add `registerExploresTools(server, client)` to the tools index.

**Rationale:** Same pattern as projects and spaces tools; read-only, no side effects.

## Command tree (CLI)

```
lightdash-tools
├── ...
├── projects explores list <projectUuid>
├── projects explores get <projectUuid> <exploreId>
└── ...
```

## Risks / Trade-offs

- **Types in common**: If Explores namespace is not yet in lightdash-api.ts, client can import from generated openapi-types or we add minimal re-exports in common. Prefer re-use of existing ApiExploresResults / ApiExploreResults.
