# Design: MCP server using Lightdash HTTP client

## Context

- `packages/mcp` currently exports a placeholder (`greet`). The plan is to implement an MCP server that exposes Lightdash operations as tools, using `@lightdash-tools/client` for all backend calls.
- The client supports `mergeConfig(partial)` and env vars (`LIGHTDASH_URL`, `LIGHTDASH_API_KEY`); the CLI uses this pattern in `packages/cli/src/utils/client.ts`.
- MCP TypeScript SDK provides `McpServer`, `StdioServerTransport`, and `StreamableHTTPServerTransport`; tools are registered with `server.registerTool(name, { description, inputSchema }, handler)` and Zod for `inputSchema`.

## Goals / Non-Goals

**Goals:**

- Single MCP server codebase; transport (Stdio vs HTTP) selected at startup or via entrypoint.
- All Lightdash calls go through `LightdashClient`; no direct axios/fetch to Lightdash API from the MCP package.
- Safe error handling: map client errors to MCP text content; never log or return PAT or tokens.
- Phase 2: HTTP endpoint optionally protected by Bearer or API key.

**Non-Goals:**

- OAuth or token introspection for MCP (can be added later); full multi-tenant identity.
- Resources or Prompts in the first implementation (Tools only).

## Decisions

### Decision 1: Package layout

**Choice:** Under `packages/mcp/src/`:

- **config.ts** (or **env.ts**): Load `PartialLightdashClientConfig` from env (reuse client’s env var names); export a function that returns merged config for `new LightdashClient(config)`.
- **server.ts** (or **index.ts**): Create `LightdashClient`, create `McpServer`, register tools, connect transport. For Stdio: single entrypoint that uses `StdioServerTransport`. For HTTP: separate entrypoint or branch that creates HTTP server and wires `StreamableHTTPServerTransport` with session map.
- **tools/** (optional): One module or multiple that register tools (e.g. projects, charts, dashboards, spaces, users, groups); each tool receives the client (or a shared context) and returns `{ content: [{ type: 'text', text: string }] }`. Wrap client calls in try/catch and map errors to text content.
- **errors.ts** (optional): Helper that maps `LightdashApiError` / `RateLimitError` / `NetworkError` to a short user-facing message string.

**Rationale:** Clear separation of config, server bootstrap, and tool logic; easy to test error mapping in isolation.

### Decision 2: Client lifecycle

**Choice:** One `LightdashClient` instance per process. For Stdio, created at startup. For HTTP, same: one client shared by all sessions (process-wide PAT). No per-request or per-session client unless we add OAuth-derived credentials later.

**Rationale:** Matches CLI and keeps Phase 1/2 simple; rate limiting and retry are per-process as in the client design.

### Decision 3: Transport selection

**Choice:** Either (a) env var `MCP_TRANSPORT=stdio|streamable-http` and one entrypoint that branches, or (b) two entrypoints (e.g. `dist/index.js` for Stdio, `dist/http.js` for HTTP). Prefer (b) if it simplifies CLI invocation (e.g. `node dist/http.js` for HTTP server).

**Rationale:** Allows “run Stdio for local” vs “run HTTP for remote” without code duplication in tool registration.

### Decision 4: Phase 2 auth middleware

**Choice:** Middleware that runs before the MCP HTTP handler. If `MCP_AUTH_ENABLED` (or equivalent) is set, require `Authorization: Bearer <token>` or a custom header (e.g. `X-API-Key`) to match a configured value. On failure, respond with 401 and optional `WWW-Authenticate` or JSON body. Do not log the header value.

**Rationale:** Simple and sufficient for API-key or fixed-token deployments; OAuth can be added later without changing tool code.

### Decision 5: Session storage for HTTP

**Choice:** In-memory map: `sessionId -> StreamableHTTPServerTransport`. On first request without `Mcp-Session-Id` (and body indicating `initialize`), create a new transport and server instance, generate session id, store in map. On subsequent requests, look up by `Mcp-Session-Id`. On transport close, remove from map.

**Rationale:** Matches MCP Streamable HTTP usage; no persistence required for MVP.

## Risks / Trade-offs

- **Single PAT for HTTP:** All HTTP sessions share one client and thus one PAT; fine for single-tenant or trusted callers; multi-tenant would need per-session credentials later.
- **In-memory sessions:** Server restart loses sessions; acceptable for Phase 2.

## Migration Plan

- No migration. New functionality in `packages/mcp`; existing packages unchanged. Remove or replace placeholder `greet` when adding the real server.
