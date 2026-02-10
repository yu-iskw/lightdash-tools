# Tasks: MCP server using Lightdash HTTP client

## Phase 0 (already done)

- [x] Create parent GitHub issue and sub-issues; add to project; link sub-issues to parent.
- [x] Create ADR-0013 and fill Context, Decision, Consequences, References.
- [x] Create OpenSpec change (proposal, spec, design, tasks).

---

## Phase 1: Stdio MCP server

### 1.1 Package setup

- [ ] 1.1.1 In `packages/mcp/package.json`, add dependencies: `@modelcontextprotocol/sdk`, `zod`, `@lightdash-tools/client` (and `@lightdash-tools/common` if needed). Use `workspace:*` for internal packages.
- [ ] 1.1.2 Align `packages/mcp/tsconfig.json` with build output (e.g. `outDir: "./dist"`); ensure module/target are compatible with SDK and client (CommonJS or ESM as chosen).

### 1.2 Client and server bootstrap

- [ ] 1.2.1 Create a config module that builds `PartialLightdashClientConfig` from env (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`), mirroring `packages/cli/src/utils/client.ts` (e.g. use `loadConfigFromEnv` / `mergeConfig` from client or re-export).
- [ ] 1.2.2 In the MCP entrypoint: instantiate `LightdashClient` once from merged config, create `McpServer`, attach `StdioServerTransport`, connect. Use stderr only for logging (no `console.log`).

### 1.3 Tool registration (MVP set)

- [ ] 1.3.1 Register tools with Zod `inputSchema` and safe error handling: list_projects, get_project (client.v1.projects).
- [ ] 1.3.2 Register list_charts, get_chart; list_dashboards, get_dashboard; list_spaces, get_space (client.v1.charts, dashboards, spaces).
- [ ] 1.3.3 Register list_organization_members, get_member; list_groups, get_group (client.v1.users, groups).
- [ ] 1.3.4 Map `LightdashApiError`, `RateLimitError`, `NetworkError` to MCP `content: [{ type: 'text', text: ... }]`; never expose stack or tokens.

### 1.4 Tests and verification

- [ ] 1.4.1 Add unit or integration tests for error mapping and/or tool handlers (e.g. with a test client or mocks as appropriate per project testing guidelines).
- [ ] 1.4.2 Run `pnpm build` and `pnpm test` from repo root; fix any failures.
- [ ] 1.4.3 Verify with MCP Inspector or Claude Desktop: list tools and call at least one tool.

---

## Phase 2: Streamable HTTP + optional auth

### 2.1 HTTP transport and handler

- [x] 2.1.1 Use `StreamableHTTPServerTransport`; wire to an HTTP server (e.g. Express or Node `http`). Session handling: create transport on first MCP `initialize`, store in session map by session id; subsequent requests use `Mcp-Session-Id`.
- [x] 2.1.2 Expose POST (and GET/DELETE if required) for the MCP endpoint; read body and call `transport.handleRequest(req, res, body)`.

### 2.2 Optional auth middleware

- [x] 2.2.1 Add middleware that validates `Authorization: Bearer` or API key header when auth is enabled; return 401 when required and missing/invalid. Do not log tokens or keys.
- [x] 2.2.2 Make auth configurable (e.g. `MCP_AUTH_ENABLED`, `MCP_API_KEY` or similar env).

### 2.3 Entrypoint and docs

- [x] 2.3.1 Support choosing transport via env or separate entrypoint (e.g. `dist/index.js` Stdio, `dist/http.js` HTTP). Document in README: how to run each mode, required env vars (client + optional auth).

### 2.4 Tests and verification

- [ ] 2.4.1 Smoke-test HTTP endpoint with valid auth and with missing/invalid auth (expect 401 when auth enabled).
- [ ] 2.4.2 Run build/test/lint; verify with MCP Inspector against HTTP URL.

---

## After implementation: Changelog

- [x] Add changelog fragments (e.g. feat: MCP server Stdio; feat: Streamable HTTP + optional auth). Run `changie merge` when batching release.
