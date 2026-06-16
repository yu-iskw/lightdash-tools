# RFC: OAuth-Backed Streamable HTTP Mode for `@lightdash-tools/mcp`

> **Status:** Draft  
> **Date:** 2026-06-16  
> **Target repository:** `yu-iskw/lightdash-tools`  
> **Target package:** `@lightdash-tools/mcp`  
> **User-requested package name note:** The request mentioned `@dbt-tools/mcp`, but the inspected repository exposes the MCP package as `@lightdash-tools/mcp`. This RFC targets the actual package in the repository. If a future package is intentionally named `@dbt-tools/mcp`, the same design applies with package names adjusted.

---

## Executive Summary

`@lightdash-tools/mcp` should support **two first-class transports** with multiple HTTP auth modes:

1. **STDIO mode** for local IDE/agent use with `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`.
2. **Hosted Streamable HTTP**, including an **experimental identity-only OAuth mode** (`lightdash-oauth`) where each MCP user authenticates with Lightdash through a Lightdash OAuth application and each MCP tool call uses that user's Lightdash OAuth access token. v1 validates identity via `GET /api/v1/user` only; it is **not** production-grade, standards-aligned MCP OAuth authorization. Production use of `lightdash-oauth` requires explicit risk acceptance (`LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1`). **`shared-key` HTTP remains the production-ready option today.**

The current `@lightdash-tools/mcp` package already has:

- STDIO entrypoint using `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`.
- Streamable HTTP endpoint at `/mcp`.
- Shared `@lightdash-tools/client`.
- Tool registration across projects, charts, dashboards, spaces, users, groups, queries, content, AI agents, and evaluations.
- Safety controls: safety mode, dry-run, project allowlist, audit log, and input validation.
- Existing HTTP shared-key auth using `MCP_AUTH_ENABLED` and `MCP_API_KEY`.

The experimental `lightdash-mcp-demo` proves the missing OAuth-specific part:

- It exposes `/.well-known/oauth-protected-resource`.
- It returns `WWW-Authenticate: Bearer resource_metadata="..."` when no bearer token is supplied.
- It uses `LIGHTDASH_URL` and `MCP_PUBLIC_URL`.
- It passes a request bearer token into a Lightdash API call to `/api/v1/user`.
- It creates a minimal stateless Streamable HTTP MCP server.

This RFC recommends **integrating the demo concept, not copying the demo implementation wholesale**. The target design should refactor `@lightdash-tools/mcp` around a request-scoped credential provider and Lightdash client factory, add OAuth protected-resource metadata scaffolding, add per-request bearer-token handling, and keep all current guardrails.

The most important changes are:

```text
Current HTTP mode:
  one shared LightdashClient created at process startup from LIGHTDASH_API_KEY

Recommended experimental HTTP identity OAuth mode (`lightdash-oauth`):
  one MCP server per HTTP request/session context
  one LightdashClient per authenticated request/session
  credentials from Authorization: Bearer <Lightdash OAuth access token>
  identity validated via GET /api/v1/user only (not resource/audience binding)
  production deployable only with LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1
```

---

## 1. Intent & Issue Analysis

### 1.1 Stated Problem

Bring the custom Lightdash OAuth application concept from `yu-iskw/lightdash-mcp-demo` into `@lightdash-tools/mcp`, while keeping environment variables consistent with Lightdash's official variables such as `LIGHTDASH_URL`.

### 1.2 Underlying Intent

The underlying goal is to support a **secure, hosted, user-scoped MCP server** for Lightdash:

- Users authenticate to Lightdash through Lightdash OAuth.
- MCP tools call Lightdash with each user's credentials.
- Lightdash remains the source of truth for user permissions.
- The MCP server does not require a shared admin PAT for interactive user workflows.
- The existing `lightdash-tools` safety and governance layers continue to apply.
- Local STDIO users are not broken.
- Environment-variable naming is consistent and predictable.

### 1.3 XY Problem Check

The phrase "bring the concept and features" could be misread as "copy the demo server into `packages/mcp`." That would solve the prototype migration problem but not the production problem.

The better implementation is:

- Extract the **protocol pattern** from the demo.
- Keep the existing MCP package as the canonical implementation.
- Add pluggable auth/credential providers.
- Add HTTP OAuth metadata endpoints.
- Extend the shared client to support both PAT `ApiKey` authentication and OAuth `Bearer` authentication.
- Preserve backward compatibility for existing STDIO and shared-key HTTP users.

### 1.4 Key Finding From Code Review

The current `@lightdash-tools/mcp` package already has much of the production substrate. The gap is mostly **auth architecture**, not tool coverage.

Current MCP code path:

```mermaid
flowchart TD
    A["lightdash-mcp CLI"] --> B{"--http?"}
    B -->|"no"| C["src/index.ts"]
    B -->|"yes"| D["src/http.ts"]

    C --> E["getClient() from LIGHTDASH_URL + LIGHTDASH_API_KEY"]
    D --> E

    E --> F["createLightdashMcpServer(client)"]
    F --> G["registerCapabilities(server, client)"]
    G --> H["registerTools(server, client)"]
```

The current architecture passes a concrete `LightdashClient` into `registerCapabilities` and then into all tool modules. That works for STDIO and shared credentials, but is the wrong abstraction for hosted OAuth because the client must be user/request-scoped.

---

## 2. Verified Current State

### 2.1 Repository and Package Structure

The monorepo root package uses pnpm workspaces with `packages/*`, and `packages/mcp/package.json` defines the package as `@lightdash-tools/mcp` with binary `lightdash-mcp`.

Current root package scripts include `build`, `test`, `lint`, `verify`, and related validation tasks. The root `engines` require Node `>=24.13.0` and pnpm `>=11.5.3`.

Current package definition:

```json
{
  "name": "@lightdash-tools/mcp",
  "version": "0.6.0",
  "description": "MCP server and utilities for Lightdash AI.",
  "bin": {
    "lightdash-mcp": "./dist/bin.js"
  },
  "dependencies": {
    "@lightdash-tools/client": "workspace:*",
    "@lightdash-tools/common": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "commander": "^15.0.0",
    "zod": "^4.4.3"
  }
}
```

### 2.2 Current STDIO Entry Point

`packages/mcp/src/index.ts` is the STDIO entrypoint. Its header says it uses `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`, initializes audit logging, creates a client through `getClient()`, creates the MCP server, and connects through `StdioServerTransport`.

### 2.3 Current HTTP Entry Point

`packages/mcp/src/http.ts` already implements a Streamable HTTP server using Node's `http` module and `StreamableHTTPServerTransport`.

Current behavior:

- MCP endpoint path: `/mcp`.
- Default port: `MCP_HTTP_PORT ?? 3100`.
- Session map with TTL and max sessions.
- Health endpoints: `/health/live` and `/health/ready`.
- Optional origin allowlist: `MCP_ALLOWED_ORIGINS`.
- Optional shared-key endpoint auth: `MCP_AUTH_ENABLED` + `MCP_API_KEY`.
- One shared `LightdashClient` is created at module scope using `getClient()`.

The main limitation is this line of architecture:

```ts
const sharedClient = getClient();
```

That makes the HTTP server credential model process-global, which is incompatible with per-user OAuth.

### 2.4 Current Config and Environment Variables

`packages/mcp/src/config.ts` uses `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` through `@lightdash-tools/client`'s `mergeConfig()`. It also uses:

- `LIGHTDASH_TOOLS_DRY_RUN`
- `LIGHTDASH_TOOLS_AUDIT_LOG`
- `LIGHTDASH_TOOLS_SAFETY_MODE`
- `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`
- `LIGHTDASH_TOOLS_MCP_PROFILES`

The common environment-variable constants explicitly document that project-specific variables should use the `LIGHTDASH_TOOLS_` prefix, while official Lightdash variables remain `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`.

### 2.5 Current Lightdash Client Authentication

The current `LightdashClientConfig` requires:

```ts
baseUrl: string;
personalAccessToken: SecretString;
```

The Axios request interceptor always derives an API-key header:

```ts
const rawToken = config.personalAccessToken.expose();
const token = rawToken.startsWith('ldpat_') ? rawToken : `ldpat_${rawToken}`;
req.headers.Authorization = `ApiKey ${token}`;
```

That is correct for PAT/API-key mode but insufficient for Lightdash OAuth access-token mode, where the upstream Lightdash API should receive:

```http
Authorization: Bearer <access-token>
```

### 2.6 Current Tool Registration and Guardrails

`registerCapabilities(server, client)` always registers tools and conditionally registers resources and prompts based on profiles. `registerTools(server, client)` delegates to domain modules for projects, charts, dashboards, spaces, users, groups, query, explores, metrics, schedulers, tags, content, AI agents, and agent ops.

The shared tool helper `registerToolSafe` already applies layered guardrails:

1. Audit log wrapper.
2. Project allowlist.
3. Input validation.
4. Dry-run wrapper.
5. Safety-mode wrapper.
6. Raw handler.

This should be preserved.

### 2.7 Demo OAuth Pattern

The demo server has:

- `GET /health`
- `GET /.well-known/oauth-protected-resource`
- `GET /mcp` returning `405`
- `POST /mcp` requiring bearer auth
- `WWW-Authenticate: Bearer resource_metadata="..."`
- OAuth protected resource metadata containing:
  - `resource: <public-url>/mcp`
  - `authorization_servers: [LIGHTDASH_URL]`
  - `bearer_methods_supported: ['header']`
  - `scopes_supported: ['read', 'write', 'mcp:read', 'mcp:write']`

The demo also shows a simple Lightdash OAuth-token validation call by requesting:

```http
GET {LIGHTDASH_URL}/api/v1/user
Authorization: Bearer <access-token>
```

This is the identity-validation and protected-resource metadata pattern to integrate as **experimental identity-only OAuth**, not as production-grade standards-aligned MCP OAuth authorization.

---

## 3. External Requirements

### 3.1 Lightdash CLI Environment Variables

Lightdash's official CLI documentation defines core environment variables:

| Variable                        | Official meaning                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_API_KEY`             | API access token for authentication. Overrides the API key stored in the config file. Useful for CI/CD. |
| `LIGHTDASH_URL`                 | Lightdash server URL, e.g. `https://app.lightdash.cloud`.                                               |
| `LIGHTDASH_PROJECT`             | Project UUID to use for CLI commands.                                                                   |
| `LIGHTDASH_PROXY_AUTHORIZATION` | Proxy authorization header for proxied access.                                                          |
| `CI`                            | Non-interactive CI mode.                                                                                |
| `DBT_PROJECT_DIR`               | Directory of dbt project.                                                                               |
| `DBT_PROFILES_DIR`              | Directory of dbt profiles.                                                                              |

`@lightdash-tools/mcp` should continue to use official variables for Lightdash core configuration, especially `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, and `LIGHTDASH_PROXY_AUTHORIZATION`.

### 3.2 MCP Authorization Requirements

The MCP authorization specification says:

- HTTP-based transports that support authorization should conform to the MCP authorization spec.
- STDIO transports should not follow the HTTP authorization spec and should retrieve credentials from the environment.
- A protected MCP server acts as an OAuth resource server.
- The authorization server issues access tokens.
- MCP servers must implement OAuth 2.0 Protected Resource Metadata for authorization-server discovery.
- Protected resource metadata must include `authorization_servers`.
- MCP servers can advertise protected-resource metadata through `WWW-Authenticate` on `401 Unauthorized` and/or well-known URI.
- Runtime insufficient-scope errors should use `403 Forbidden` with `WWW-Authenticate: Bearer error="insufficient_scope", scope="...", resource_metadata="..."`.

This aligns well with a design where:

- `@lightdash-tools/mcp` is the MCP resource server.
- Lightdash is the authorization server and upstream resource API.
- MCP clients perform OAuth with Lightdash and send access tokens to the MCP server.
- The MCP server validates and uses the token against Lightdash.

---

## 4. Goals and Non-Goals

### 4.1 Goals

1. Add **experimental identity-only OAuth mode** (`lightdash-oauth`) to `@lightdash-tools/mcp`, production-deployable only with explicit risk acceptance (`LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1`). **`shared-key` HTTP remains the production-ready option.**
2. Keep STDIO mode fully backward-compatible.
3. Keep existing shared-key HTTP mode backward-compatible initially, but deprecate inconsistent env names.
4. Make environment variables consistent:
   - Use official Lightdash variables for Lightdash connection/auth.
   - Use `LIGHTDASH_TOOLS_` prefix for tool-specific/server-specific controls.
5. Add OAuth protected-resource metadata endpoints.
6. Add `WWW-Authenticate` challenge behavior.
7. Add a per-request or per-session bearer-token credential provider.
8. Extend `@lightdash-tools/client` to support both `ApiKey` and `Bearer` auth schemes.
9. Preserve all safety, dry-run, allowlist, audit, and validation guardrails.
10. Add tests for STDIO, shared-key HTTP, and OAuth HTTP modes.
11. Document Cursor/remote MCP setup, Cloud Run deployment, and experimental identity-only OAuth limitations (including `LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH`).

### 4.2 Non-Goals

1. Do not implement a new OAuth authorization server.
2. Do not store OAuth refresh tokens by default.
3. Do not replace Lightdash object-level authorization with a custom RBAC system.
4. Do not remove STDIO or PAT-based workflows.
5. Do not make destructive tools available by default.
6. Do not add browser-based UI flows inside `@lightdash-tools/mcp`.
7. Do not require `LIGHTDASH_OAUTH_CLIENT_SECRET` in the MCP server for the normal MCP OAuth flow.

---

## 5. Proposed Architecture

### 5.1 High-Level Architecture

```mermaid
flowchart TD
    subgraph Clients
      A1["Claude Desktop / Claude Code / Cursor local"]
      A2["Cursor remote MCP / OAuth-aware MCP client"]
    end

    subgraph Package["@lightdash-tools/mcp"]
      B1["STDIO Transport"]
      B2["Streamable HTTP Transport"]
      C1["Env Credential Provider"]
      C2["Bearer Token Credential Provider"]
      D["Request/Session Context Factory"]
      E["MCP Server Factory"]
      F["Tool Registry"]
      G["Guardrails: safety, dry-run, allowlist, validation, audit"]
    end

    subgraph Lightdash
      H["Lightdash OAuth / Authorization Server"]
      I["Lightdash API"]
      J["Lightdash Permission Model"]
    end

    A1 --> B1
    A2 --> B2
    B1 --> C1
    B2 --> C2
    C1 --> D
    C2 --> D
    D --> E
    E --> F
    F --> G
    G --> I
    A2 --> H
    H --> A2
    I --> J
```

### 5.2 Auth Modes

Define these auth modes:

| Mode              | Transport | Credential source                              | Lightdash upstream auth           | Intended use                               |
| ----------------- | --------- | ---------------------------------------------- | --------------------------------- | ------------------------------------------ |
| `env`             | STDIO     | `LIGHTDASH_API_KEY`                            | `Authorization: ApiKey ldpat_...` | Local IDE, local agents, CI                |
| `shared-key`      | HTTP      | `LIGHTDASH_API_KEY` plus MCP endpoint key      | `Authorization: ApiKey ldpat_...` | Backward-compatible private HTTP           |
| `lightdash-oauth` | HTTP      | Request `Authorization: Bearer ...`            | `Authorization: Bearer ...`       | Hosted user-scoped remote MCP              |
| `none`            | HTTP      | `LIGHTDASH_API_KEY` only, no MCP endpoint auth | `Authorization: ApiKey ldpat_...` | Local development only; should warn loudly |

### 5.3 Recommended CLI Surface

Current CLI uses a boolean `--http`. Keep it but add subcommands over time.

Backward-compatible:

```bash
npx @lightdash-tools/mcp
npx @lightdash-tools/mcp --http
```

Recommended new commands:

```bash
# Local STDIO mode
lightdash-mcp stdio

# Hosted HTTP mode with explicit auth mode
lightdash-mcp serve-http --auth-mode lightdash-oauth

# Backward-compatible shared-key HTTP
lightdash-mcp serve-http --auth-mode shared-key

# Development only
lightdash-mcp serve-http --auth-mode none
```

Aliases:

```bash
lightdash-mcp               # alias: stdio
lightdash-mcp --http        # alias: serve-http, auth mode from env/default
```

### 5.4 Recommended Source Layout

```text
packages/mcp/src/
  index.ts                         # STDIO compatibility entrypoint
  http.ts                          # HTTP compatibility entrypoint
  bin.ts                           # CLI

  app/
    create-stdio-app.ts
    create-http-app.ts
    request-context.ts

  auth/
    auth-mode.ts
    bearer.ts
    credential-provider.ts
    env-credential-provider.ts
    shared-key-middleware.ts
    lightdash-oauth-middleware.ts
    oauth-protected-resource.ts
    www-authenticate.ts

  config/
    env.ts
    load-mcp-config.ts
    normalize-url.ts

  transports/
    stdio.ts
    streamable-http.ts
    session-store.ts

  server/
    create-mcp-server.ts
    register-capabilities.ts

  tools/
    index.ts
    shared.ts
    ...
```

This keeps compatibility while making responsibilities explicit.

---

## 6. Environment Variable Standard

### 6.1 Naming Principles

1. **Use official Lightdash variables unchanged**:
   - `LIGHTDASH_URL`
   - `LIGHTDASH_API_KEY`
   - `LIGHTDASH_PROJECT`
   - `LIGHTDASH_PROXY_AUTHORIZATION`

2. **Use `LIGHTDASH_TOOLS_` for this project's controls**:
   - Existing guardrail variables already follow this.
   - New MCP server variables should also follow this.

3. **Deprecate generic `MCP_*` variables gradually**:
   - Keep aliases for backward compatibility.
   - Emit one-time warnings when old names are used.
   - Document removal in a future major version.

### 6.2 Core Lightdash Variables

| Variable                        | Mode                    | Required | Description                                                                                 |
| ------------------------------- | ----------------------- | -------: | ------------------------------------------------------------------------------------------- |
| `LIGHTDASH_URL`                 | All modes               |      Yes | Lightdash instance base URL. Normalize by removing trailing slash.                          |
| `LIGHTDASH_API_KEY`             | STDIO, shared-key, none |      Yes | PAT/API key for service-style access. Not required in `lightdash-oauth` mode.               |
| `LIGHTDASH_PROJECT`             | Optional                |       No | Default project UUID where relevant. Should not replace `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`. |
| `LIGHTDASH_PROXY_AUTHORIZATION` | Optional                |       No | Forwarded to Lightdash as `Proxy-Authorization` when calling Lightdash.                     |

### 6.3 Existing `LIGHTDASH_TOOLS_` Variables

| Variable                           | Current / proposed | Description                                                                                              |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_SAFETY_MODE`      | Keep               | `read-only`, `write-nondestructive`, `write-idempotent` alias, `write-destructive`. Default `read-only`. |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` | Keep               | Comma-separated project UUID allowlist. Empty means all projects.                                        |
| `LIGHTDASH_TOOLS_DRY_RUN`          | Keep               | `1`, `true`, or `yes` simulates mutating operations.                                                     |
| `LIGHTDASH_TOOLS_AUDIT_LOG`        | Keep               | Audit log path; stderr when unset.                                                                       |
| `LIGHTDASH_TOOLS_MCP_PROFILES`     | Keep               | Comma-separated capability profiles.                                                                     |

### 6.4 New MCP HTTP Variables

| New variable                                        | Old alias                          |                                                                            Default | Description                                                                  |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------: | ---------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_HTTP_HOST`                     | none                               |                                                                          `0.0.0.0` | HTTP bind host.                                                              |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`                     | `MCP_HTTP_PORT`, `MCP_SERVER_PORT` |                                                                             `3100` | HTTP port.                                                                   |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`                    | `MCP_PUBLIC_URL`                   |                                                                               none | Public HTTPS base URL for OAuth metadata. Required in production OAuth mode. |
| `LIGHTDASH_TOOLS_MCP_PATH`                          | none                               |                                                                             `/mcp` | MCP endpoint path.                                                           |
| `LIGHTDASH_TOOLS_MCP_AUTH_MODE`                     | derived from `MCP_AUTH_ENABLED`    | `lightdash-oauth` for HTTP in a future major; `none` temporarily for compatibility | `none`, `shared-key`, `lightdash-oauth`.                                     |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`                    | `MCP_API_KEY`                      |                                                                               none | Shared endpoint key for `shared-key` auth mode.                              |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`               | `MCP_ALLOWED_ORIGINS`              |                                                                              empty | Comma-separated CORS/origin allowlist. Empty means no origin restriction.    |
| `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`                | `MCP_MAX_BODY_BYTES`               |                                                                          `1048576` | Maximum JSON body size.                                                      |
| `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`                | `MCP_SESSION_TTL_MS`               |                                                                          `1800000` | Session TTL for stateful Streamable HTTP.                                    |
| `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`                  | `MCP_MAX_SESSIONS`                 |                                                                              `100` | Maximum active sessions.                                                     |
| `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`            | `MCP_SESSION_CLEANUP_MS`           |                                                                            `60000` | Cleanup interval.                                                            |
| `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`               | none                               |                                                                         `mcp:read` | Scopes advertised in `WWW-Authenticate`.                                     |
| `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`              | none                               |                                                    `read,write,mcp:read,mcp:write` | Scopes in protected-resource metadata.                                       |
| `LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN`                | none                               |                                                                  `1` in OAuth mode | Validate bearer token against `GET /api/v1/user` before tool use.            |
| `LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS` | none                               |                                                                            `30000` | Optional cache TTL for token validation by token hash.                       |

### 6.5 Compatibility Matrix

| Current variable         | New variable                               | Migration behavior                                              |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------- |
| `MCP_HTTP_PORT`          | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`            | Keep alias. New name wins if both set. Warn on old name.        |
| `MCP_SERVER_PORT`        | `LIGHTDASH_TOOLS_MCP_HTTP_PORT`            | Keep alias for demo migration. New name wins. Warn on old name. |
| `MCP_PUBLIC_URL`         | `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`           | Keep alias for demo migration. New name wins. Warn on old name. |
| `MCP_AUTH_ENABLED`       | `LIGHTDASH_TOOLS_MCP_AUTH_MODE=shared-key` | If true and new auth mode unset, use `shared-key`. Warn.        |
| `MCP_API_KEY`            | `LIGHTDASH_TOOLS_MCP_SHARED_KEY`           | Keep alias. New name wins. Warn.                                |
| `MCP_ALLOWED_ORIGINS`    | `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`      | Keep alias. New name wins. Warn.                                |
| `MCP_MAX_BODY_BYTES`     | `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`       | Keep alias. New name wins. Warn.                                |
| `MCP_SESSION_TTL_MS`     | `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`       | Keep alias. New name wins. Warn.                                |
| `MCP_MAX_SESSIONS`       | `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`         | Keep alias. New name wins. Warn.                                |
| `MCP_SESSION_CLEANUP_MS` | `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`   | Keep alias. New name wins. Warn.                                |

---

## 7. Required Client Refactor

### 7.1 Problem

Current `@lightdash-tools/client` assumes every request uses `Authorization: ApiKey ldpat_...`.

OAuth mode needs `Authorization: Bearer <access-token>`.

### 7.2 Proposed Config Model

Add an explicit auth union while preserving existing `personalAccessToken` config.

```ts
export type LightdashAuthConfig =
  | {
      type: 'api-key';
      token: SecretString;
    }
  | {
      type: 'bearer';
      token: SecretString;
    };

export interface LightdashClientConfig {
  baseUrl: string;
  auth: LightdashAuthConfig;

  // Keep during migration:
  personalAccessToken?: SecretString;

  proxyAuthorization?: SecretString;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retry?: RetryConfig;
  logger?: Logger;
  observability?: ObservabilityHooks;
}
```

For backward compatibility:

```ts
new LightdashClient({
  baseUrl,
  personalAccessToken: '...',
});
```

should be normalized into:

```ts
auth: {
  type: 'api-key',
  token: SecretString(...)
}
```

### 7.3 Request Interceptor Change

Current logic:

```ts
const rawToken = config.personalAccessToken.expose();
const token = rawToken.startsWith('ldpat_') ? rawToken : `ldpat_${rawToken}`;
req.headers.Authorization = `ApiKey ${token}`;
```

Recommended logic:

```ts
switch (config.auth.type) {
  case 'api-key': {
    const rawToken = config.auth.token.expose();
    const token = rawToken.startsWith('ldpat_') ? rawToken : `ldpat_${rawToken}`;
    req.headers.Authorization = `ApiKey ${token}`;
    break;
  }

  case 'bearer': {
    req.headers.Authorization = `Bearer ${config.auth.token.expose()}`;
    break;
  }
}
```

### 7.4 Environment Loader

`loadConfigFromEnv()` should remain API-key oriented because official Lightdash env vars expose `LIGHTDASH_API_KEY`.

Add helper constructors:

```ts
export function createApiKeyConfigFromEnv(): PartialLightdashClientConfig;
export function createBearerConfig(options: {
  baseUrl: string;
  accessToken: string | SecretString;
  proxyAuthorization?: string | SecretString;
}): PartialLightdashClientConfig;
```

Alternative simpler API:

```ts
new LightdashClient({
  baseUrl: LIGHTDASH_URL,
  auth: {
    type: 'bearer',
    token: accessToken,
  },
});
```

---

## 8. MCP Request Context Refactor

### 8.1 Problem

Today tools are registered against a concrete `LightdashClient`. In OAuth mode, credentials are request-scoped. We need a stable way for handlers to obtain the right client.

### 8.2 Proposed Context Type

```ts
export type McpAuthMode = 'env' | 'none' | 'shared-key' | 'lightdash-oauth';

export interface LightdashMcpRequestContext {
  lightdashClient: LightdashClient;
  auth: {
    mode: McpAuthMode;
    subject?: string;
    tokenHash?: string;
    scopes?: string[];
  };
  governance: {
    safetyMode: SafetyMode;
    dryRun: boolean;
    allowedProjectUuids: string[];
  };
}
```

### 8.3 Context Provider

```ts
export interface McpContextProvider<TExtra = unknown> {
  getContext(extra?: TExtra): Promise<LightdashMcpRequestContext>;
}
```

STDIO implementation:

```ts
export class EnvContextProvider implements McpContextProvider {
  private readonly client = getClient();

  async getContext(): Promise<LightdashMcpRequestContext> {
    return {
      lightdashClient: this.client,
      auth: { mode: 'env' },
      governance: getGovernanceConfig(),
    };
  }
}
```

HTTP OAuth implementation:

```ts
export class BearerContextProvider implements McpContextProvider<{ authInfo?: AuthInfo }> {
  constructor(private readonly config: McpHttpConfig) {}

  async getContext(extra?: { authInfo?: AuthInfo }): Promise<LightdashMcpRequestContext> {
    const token = extra?.authInfo?.token;
    if (!token) throw new UnauthorizedError();

    const client = new LightdashClient({
      baseUrl: this.config.lightdashUrl,
      auth: { type: 'bearer', token },
      proxyAuthorization: this.config.proxyAuthorization,
    });

    return {
      lightdashClient: client,
      auth: {
        mode: 'lightdash-oauth',
        tokenHash: hashToken(token),
        scopes: extra?.authInfo?.scopes,
      },
      governance: getGovernanceConfig(),
    };
  }
}
```

### 8.4 Tool Handler Migration

Current pattern:

```ts
export function registerProjectTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(server, 'list_projects', options, async () => {
    return jsonToolResult(await client.v1.projects.listProjects());
  });
}
```

Recommended pattern:

```ts
export function registerProjectTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerToolSafe(server, 'list_projects', options, async (_args, extra) => {
    const { lightdashClient } = await contextProvider.getContext(extra);
    return jsonToolResult(await lightdashClient.v1.projects.listProjects());
  });
}
```

This is more invasive but is the cleanest architecture.

### 8.5 Lower-Risk Transitional Pattern

To reduce code churn, introduce a proxy client:

```ts
export class ContextualLightdashClient {
  constructor(private readonly contextProvider: McpContextProvider) {}

  async withClient<T>(extra: unknown, fn: (client: LightdashClient) => Promise<T>): Promise<T> {
    const ctx = await this.contextProvider.getContext(extra);
    return fn(ctx.lightdashClient);
  }
}
```

But the current tool handlers do not uniformly pass `extra` into client methods, so this only helps if tool registration wrappers are updated.

Recommendation: do the full request-context migration once and enforce it through tests.

---

## 9. HTTP OAuth Protocol Design

### 9.1 Endpoints

| Endpoint                                    | Method   | Auth                    | Behavior                                                                        |
| ------------------------------------------- | -------- | ----------------------- | ------------------------------------------------------------------------------- |
| `/health/live`                              | `GET`    | No                      | Process liveness.                                                               |
| `/health/ready`                             | `GET`    | No                      | Validates configuration. In OAuth mode, should not require `LIGHTDASH_API_KEY`. |
| `/.well-known/oauth-protected-resource`     | `GET`    | No                      | Protected-resource metadata.                                                    |
| `/.well-known/oauth-protected-resource/mcp` | `GET`    | No                      | Optional path-specific metadata.                                                |
| `/mcp`                                      | `POST`   | Depends on mode         | Streamable HTTP request.                                                        |
| `/mcp`                                      | `GET`    | Depends on mode/session | Streamable HTTP GET for session transport if supported.                         |
| `/mcp`                                      | `DELETE` | Depends on mode/session | Streamable HTTP session deletion if supported.                                  |

### 9.2 Protected Resource Metadata

```ts
export function buildOAuthProtectedResourceMetadata(config: McpHttpConfig) {
  return {
    resource: `${config.publicUrl}${config.mcpPath}`,
    authorization_servers: [config.lightdashUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopesSupported,
  };
}
```

Default output:

```json
{
  "resource": "https://lightdash-mcp.example.com/mcp",
  "authorization_servers": ["https://app.lightdash.cloud"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["read", "write", "mcp:read", "mcp:write"]
}
```

### 9.3 Unauthorized Challenge

When no bearer token is supplied in `lightdash-oauth` mode:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://lightdash-mcp.example.com/.well-known/oauth-protected-resource", scope="mcp:read"
Content-Type: application/json

{"error":"Unauthorized"}
```

### 9.4 Invalid Token

When Lightdash rejects the token:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", resource_metadata="https://lightdash-mcp.example.com/.well-known/oauth-protected-resource", scope="mcp:read"
Content-Type: application/json

{"error":"Invalid or expired Lightdash access token"}
```

### 9.5 Insufficient Scope

When a tool requires write scope and the token is insufficient:

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope", scope="mcp:write", resource_metadata="https://lightdash-mcp.example.com/.well-known/oauth-protected-resource"
Content-Type: application/json

{"error":"Insufficient scope"}
```

### 9.6 Token Validation Strategy

Default in OAuth mode:

1. Extract bearer token.
2. Optionally hash token for logs/cache using SHA-256.
3. Validate against Lightdash with `GET /api/v1/user`.
4. Store only non-sensitive derived data in request/session context:
   - subject/user UUID/email if returned,
   - token hash,
   - scopes reported by MCP auth info if available.
5. Do not log raw tokens.
6. Do not persist tokens.

Token validation cache:

```ts
interface TokenValidationCacheEntry {
  tokenHash: string;
  expiresAt: number;
  user: LightdashUser;
}
```

Use a short TTL, e.g. 30 seconds, only to reduce `/api/v1/user` calls. Never store raw tokens.

---

## 10. Streamable HTTP Session Strategy

### 10.1 Current Session-Based Mode

The current HTTP server uses `sessionMap` and `Mcp-Session-Id`, with a new `StreamableHTTPServerTransport` and MCP server per session. That can continue.

### 10.2 OAuth Session Risk

A stateful MCP session created under one user's token must not accidentally accept requests from another user's token.

Required rule:

```text
If a session is created with token hash H1, every subsequent request with that session ID must carry a bearer token with hash H1.
```

If a different token is presented for the same session:

```http
HTTP/1.1 401 Unauthorized
{"error":"Session token mismatch"}
```

### 10.3 Session Entry

```ts
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastAccessAt: number;
  auth: {
    mode: McpAuthMode;
    tokenHash?: string;
    subject?: string;
  };
}
```

### 10.4 Alternative Stateless Mode

The demo uses `sessionIdGenerator: undefined` and creates a server per request. This is simpler and safer for OAuth but may not support all Streamable HTTP session behavior.

Recommendation:

- Keep current stateful mode for compatibility.
- Add config option:

```text
LIGHTDASH_TOOLS_MCP_SESSION_MODE=stateful|stateless
```

Default:

- `stateful` for compatibility.
- Consider `stateless` for OAuth mode only after testing with target MCP clients.

---

## 11. Governance and Safety

### 11.1 Preserve Existing Guardrails

The existing guardrail ordering in `registerToolSafe` should remain:

1. Audit log.
2. Project allowlist.
3. Input validation.
4. Dry-run.
5. Safety mode.
6. Raw handler.

The OAuth refactor should not weaken these layers.

### 11.2 Safety Mode Defaults

Default remains:

```text
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
```

Hosted OAuth examples should explicitly set:

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
```

For write-enabled deployments:

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=write-nondestructive
LIGHTDASH_TOOLS_ALLOWED_PROJECTS=project_uuid_1,project_uuid_2
```

Destructive mode should require an explicit setting:

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=write-destructive
```

### 11.3 Scope-Aware Tool Requirements

Map MCP tool annotations to coarse OAuth scopes:

| Tool annotation       | Required MCP scope                               |
| --------------------- | ------------------------------------------------ |
| `readOnlyHint: true`  | `mcp:read`                                       |
| non-destructive write | `mcp:write`                                      |
| destructive write     | `mcp:write` plus safety mode `write-destructive` |

This scope check should be additional to Lightdash authorization, not a replacement.

### 11.4 Lightdash Authorization Remains Authoritative

The MCP server must not attempt to recreate Lightdash object-level permissions. It should:

- Use the user's Lightdash OAuth access token.
- Let Lightdash API return `401`, `403`, or object-specific errors.
- Convert errors into MCP tool errors without leaking sensitive details.

---

## 12. Detailed Implementation Plan

### Phase 0: Add RFC and ADR

Deliverables:

- Add this RFC under `docs/rfc/`.
- Add an ADR under `docs/adr/` summarizing:
  - chosen architecture,
  - env-var naming policy,
  - OAuth mode threat model,
  - migration strategy.

Recommended files:

```text
docs/rfc/004x-oauth-backed-streamable-http-mcp.md
docs/adr/004x-oauth-backed-streamable-http-mcp.md
```

### Phase 1: Normalize MCP Config

Create:

```text
packages/mcp/src/config/env.ts
packages/mcp/src/config/load-mcp-config.ts
packages/mcp/src/config/normalize-url.ts
```

Implement:

- New `LIGHTDASH_TOOLS_MCP_*` variables.
- Old `MCP_*` aliases.
- One-time deprecation warnings.
- Zod validation.
- Public URL normalization that strips trailing slash and `/mcp`.

Example config type:

```ts
export interface McpHttpConfig {
  lightdashUrl: string;
  proxyAuthorization?: SecretString;
  host: string;
  port: number;
  publicUrl?: string;
  mcpPath: string;
  authMode: 'none' | 'shared-key' | 'lightdash-oauth';
  sharedKey?: SecretString;
  allowedOrigins: string[];
  maxBodyBytes: number;
  sessionTtlMs: number;
  maxSessions: number;
  sessionCleanupMs: number;
  requiredScopes: string[];
  scopesSupported: string[];
  validateToken: boolean;
  tokenValidationCacheTtlMs: number;
}
```

Acceptance criteria:

- Existing `MCP_HTTP_PORT` still works.
- New `LIGHTDASH_TOOLS_MCP_HTTP_PORT` wins over old alias.
- `LIGHTDASH_URL` is required for all modes.
- `LIGHTDASH_API_KEY` is not required for `lightdash-oauth`.
- `LIGHTDASH_API_KEY` remains required for STDIO and shared API-key modes.

### Phase 2: Extend `@lightdash-tools/client` Auth

Modify:

- `packages/client/src/config.ts`
- `packages/client/src/utils/env.ts`
- `packages/client/src/http/interceptors.ts`
- tests.

Add:

- `auth` union.
- `bearer` auth mode.
- Backward-compatible `personalAccessToken`.

Acceptance criteria:

- Existing tests pass unchanged.
- New tests prove:
  - API-key config emits `Authorization: ApiKey ldpat_...`.
  - API-key config does not double-prefix `ldpat_`.
  - Bearer config emits `Authorization: Bearer ...`.
  - Proxy authorization still works in both modes.
  - `mergeConfig()` from env still behaves as before.

### Phase 3: Refactor MCP Server Factory

Change:

```ts
createLightdashMcpServer(client: LightdashClient, options?)
```

to:

```ts
createLightdashMcpServer(contextProvider: McpContextProvider, options?)
```

Update:

- `registerCapabilities`
- `registerTools`
- every tool module

Tool handlers should obtain the client from context:

```ts
const { lightdashClient } = await contextProvider.getContext(extra);
```

Acceptance criteria:

- No tool module stores a process-global user credential.
- Existing STDIO mode still works.
- Tool names remain unchanged.
- Tool annotations remain unchanged.
- Safety filtering still works.

### Phase 4: Implement OAuth Middleware and Metadata

Create:

- `auth/bearer.ts`
- `auth/lightdash-oauth-middleware.ts`
- `auth/oauth-protected-resource.ts`
- `auth/www-authenticate.ts`

Implement:

- Bearer token extraction.
- Missing-token challenge.
- Invalid-token challenge.
- Metadata endpoint.
- Optional path-specific metadata endpoint.

Acceptance criteria:

- `GET /.well-known/oauth-protected-resource` returns valid metadata.
- `POST /mcp` without bearer token returns `401` with `WWW-Authenticate`.
- `WWW-Authenticate` includes `resource_metadata`.
- In OAuth mode, `LIGHTDASH_API_KEY` is not required.
- In OAuth mode, token is passed to Lightdash as `Bearer`.

### Phase 5: Update HTTP Transport

Refactor `http.ts` into:

- transport/session-store pieces,
- auth middleware,
- request handler.

Required behavior:

- Auth is applied before MCP handling.
- Health endpoints are unauthenticated.
- Metadata endpoints are unauthenticated.
- `/mcp` is authenticated according to mode.
- Session token hash binding is enforced in OAuth mode.

Acceptance criteria:

- Existing `--http` still works.
- Existing `MCP_AUTH_ENABLED=1 MCP_API_KEY=...` still works with warning.
- New `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth` works.
- Stateful session cannot switch token identity mid-session.

### Phase 6: Add `get_authenticated_user` Diagnostic Tool

Add a read-only diagnostic tool:

```text
ldt__get_authenticated_user
```

Behavior:

- In OAuth mode, returns the Lightdash user associated with the bearer token.
- In API-key mode, returns the user associated with the PAT if Lightdash supports it.
- Output excludes tokens and sensitive headers.

This tool should be included by default because it is essential for E2E validation.

### Phase 7: Documentation

Update:

- `packages/mcp/README.md`
- `docs/secrets-and-credentials.md`
- add `docs/mcp-oauth-http.md`
- add `docs/cloud-run-mcp-oauth.md`
- add `docs/cursor-lightdash-oauth-mcp.md`
- add `docs/security/mcp-oauth-threat-model.md`

Documentation must include:

- Env-var table.
- Migration from `MCP_*` to `LIGHTDASH_TOOLS_MCP_*`.
- Cursor config examples.
- Cloud Run examples.
- Security checklist.
- Troubleshooting.

### Phase 8: Tests

Add unit tests:

- Config precedence.
- Deprecated env aliases.
- Auth header generation.
- Bearer extraction.
- `WWW-Authenticate` formatting.
- OAuth metadata.
- Session token mismatch.
- Guardrails still block as expected.

Add integration tests with mocked Lightdash:

- Missing bearer -> 401.
- Invalid bearer -> 401.
- Valid bearer -> tool call reaches mock Lightdash with `Bearer`.
- Two different users -> two different `get_authenticated_user` results.
- Shared-key mode still sends API-key auth upstream.
- STDIO mode still uses env API key.

Add live integration tests gated by env:

- `LIGHTDASH_URL`
- `LIGHTDASH_API_KEY`
- optional `LIGHTDASH_TOOLS_TEST_OAUTH_ACCESS_TOKEN`

### Phase 9: Release and Migration

Recommended release plan:

| Release     | Behavior                                                               |
| ----------- | ---------------------------------------------------------------------- |
| `0.x` minor | Add new env vars, OAuth mode, aliases, warnings.                       |
| next minor  | Docs and examples prefer new names only.                               |
| `1.0`       | Keep aliases if cheap, or remove only after explicit changelog notice. |

---

## 13. Example Usage

### 13.1 Local STDIO

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_API_KEY="ldpat_..."
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"

npx @lightdash-tools/mcp
```

### 13.2 Hosted OAuth HTTP

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="lightdash-oauth"
export LIGHTDASH_TOOLS_MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export LIGHTDASH_TOOLS_MCP_HTTP_PORT="3100"
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"
export LIGHTDASH_TOOLS_ALLOWED_PROJECTS="project_uuid_1,project_uuid_2"

npx @lightdash-tools/mcp serve-http
```

### 13.3 Backward-Compatible Shared-Key HTTP

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_API_KEY="ldpat_..."
export LIGHTDASH_TOOLS_MCP_AUTH_MODE="shared-key"
export LIGHTDASH_TOOLS_MCP_SHARED_KEY="server-endpoint-secret"

npx @lightdash-tools/mcp serve-http
```

Client request:

```http
Authorization: Bearer server-endpoint-secret
```

Upstream Lightdash request:

```http
Authorization: ApiKey ldpat_...
```

### 13.4 Demo-Compatible Env Aliases

For easier migration from `lightdash-mcp-demo`:

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export MCP_PUBLIC_URL="https://lightdash-mcp.example.com"
export MCP_SERVER_PORT="3100"
```

The server should accept these with warnings:

```text
Warning: MCP_PUBLIC_URL is deprecated. Use LIGHTDASH_TOOLS_MCP_PUBLIC_URL.
Warning: MCP_SERVER_PORT is deprecated. Use LIGHTDASH_TOOLS_MCP_HTTP_PORT.
```

---

## 14. Cloud Run Deployment Sketch

```dockerfile
FROM node:24-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

ENV NODE_ENV=production
ENV LIGHTDASH_TOOLS_MCP_HTTP_HOST=0.0.0.0
ENV LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
ENV LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth
ENV LIGHTDASH_TOOLS_SAFETY_MODE=read-only

CMD ["node", "packages/mcp/dist/bin.js", "serve-http"]
```

Cloud Run env:

```bash
LIGHTDASH_URL=https://app.lightdash.cloud
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app
LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
LIGHTDASH_TOOLS_ALLOWED_PROJECTS=project_uuid_1,project_uuid_2
```

Important:

- Do not set `LIGHTDASH_API_KEY` for OAuth mode unless a fallback service mode is intentionally enabled.
- Do not log request headers.
- Use Cloud Run request logs carefully; redact `Authorization`.
- Restrict ingress if the MCP client environment allows it.
- Consider Cloud Armor or an API gateway for rate limiting.

---

## 15. Threat Model

### 15.1 Assets

| Asset                        | Protection need                                                 |
| ---------------------------- | --------------------------------------------------------------- |
| Lightdash OAuth access token | Must never be logged or persisted by default.                   |
| Lightdash data/results       | Must be scoped by Lightdash permissions and project allowlists. |
| MCP endpoint                 | Must not expose tools unauthenticated in production.            |
| Session IDs                  | Must not allow user/token confusion.                            |
| Audit logs                   | Must not leak credentials or sensitive raw data unnecessarily.  |

### 15.2 Threats and Mitigations

| Threat                                       | Risk   | Mitigation                                                                           |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Public unauthenticated MCP endpoint          | High   | Default HTTP auth mode should become `lightdash-oauth`; warn loudly for `none`.      |
| Shared PAT overreach                         | High   | Prefer OAuth mode; keep `read-only`; project allowlist.                              |
| Token leakage in logs                        | High   | Redact `Authorization`, never log raw `authInfo.token`, add tests.                   |
| Token/session confusion                      | High   | Bind session ID to token hash and subject.                                           |
| OAuth metadata spoofing due wrong public URL | Medium | Require `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` in OAuth production mode.                   |
| Insufficient scope UX loop                   | Medium | Include `scope` in `WWW-Authenticate`; keep required scopes stable.                  |
| Reimplemented RBAC mismatch                  | High   | Do not implement Lightdash object RBAC; delegate to Lightdash API.                   |
| Agent destructive actions                    | High   | Keep `read-only` default; static filtering; dry-run; denylist for irrecoverable ops. |
| CSRF/browser-origin misuse                   | Medium | Optional origin allowlist; avoid cookie auth; use bearer only.                       |
| Rate-limit bypass                            | Medium | Deferred to gateway/Cloud Armor; no in-process rate limiting in v1.                  |

---

## 16. Validation Plan

### 16.1 Static Validation

Run:

```bash
pnpm validate:names
pnpm validate:deps
pnpm build
pnpm test
pnpm lint:local
```

The root `verify:pr` already chains name validation, dependency validation, build, tests, and local lint.

### 16.2 Unit Test Matrix

| Test area        | Cases                                                  |
| ---------------- | ------------------------------------------------------ |
| Config           | New env vars, old aliases, precedence, invalid values. |
| Client auth      | API key, prefixed API key, bearer token, proxy auth.   |
| OAuth metadata   | Public URL normalization, path-specific metadata.      |
| WWW-Authenticate | missing token, invalid token, insufficient scope.      |
| Session store    | TTL, max sessions, token hash binding.                 |
| Guardrails       | safety modes, dry-run, project allowlist, validation.  |

### 16.3 Mock Integration Test Matrix

| Scenario                      | Expected                                                             |
| ----------------------------- | -------------------------------------------------------------------- |
| OAuth mode without token      | `401`, `WWW-Authenticate` with `resource_metadata`.                  |
| OAuth mode with invalid token | `401`, no raw token in logs.                                         |
| OAuth mode with valid token   | Lightdash mock receives `Authorization: Bearer ...`.                 |
| User A and User B             | `ldt__get_authenticated_user` returns distinct users.                |
| Shared-key mode               | MCP endpoint auth uses shared key; Lightdash upstream uses `ApiKey`. |
| STDIO mode                    | Uses `LIGHTDASH_API_KEY`; no HTTP OAuth behavior.                    |

### 16.4 Manual E2E

1. Create a Lightdash OAuth application.
2. Deploy MCP HTTP server with:
   - `LIGHTDASH_URL`
   - `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`
   - `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`
3. Configure Cursor or another OAuth-aware MCP client with the MCP URL.
4. Confirm the client receives `401` and discovers metadata.
5. Complete Lightdash OAuth flow.
6. Call:
   - `ldt__get_authenticated_user`
   - `ldt__list_projects`
   - `ldt__list_project_agents`
7. Repeat with a second Lightdash user and verify the user identity and permissions differ.

---

## 17. Acceptance Criteria

The implementation is complete when:

1. `npx @lightdash-tools/mcp` still works in STDIO mode using `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`.
2. `npx @lightdash-tools/mcp --http` still works with backward-compatible behavior.
3. `lightdash-mcp serve-http --auth-mode lightdash-oauth` works without `LIGHTDASH_API_KEY`.
4. `GET /.well-known/oauth-protected-resource` returns metadata with `authorization_servers`.
5. Missing OAuth bearer token returns `401` with `WWW-Authenticate` and `resource_metadata`.
6. Valid OAuth bearer token is forwarded to Lightdash as `Authorization: Bearer ...`.
7. API-key mode still forwards to Lightdash as `Authorization: ApiKey ldpat_...`.
8. No raw token appears in logs or audit entries.
9. Existing tool names and annotations remain stable.
10. Safety mode, dry-run, project allowlist, audit logging, and input validation still apply.
11. Session token hash binding prevents token switching within a session.
12. Docs include env-var migration from `MCP_*` to `LIGHTDASH_TOOLS_MCP_*`.
13. Tests cover OAuth, shared-key HTTP, and STDIO.

---

## 18. Open Questions

1. What exact scopes does Lightdash's custom OAuth application issue today, and can they be configured as `mcp:read` and `mcp:write`?
2. Does Lightdash OAuth access token audience identify the Lightdash API, the OAuth application, or both?
3. Does every OAuth-aware MCP client support `authorization_servers: [LIGHTDASH_URL]`, or do some require a more specific issuer URL?
4. Should OAuth HTTP mode default to stateful or stateless Streamable HTTP?
5. Should `ldt__get_authenticated_user` be always registered, or only in a diagnostics profile?
6. Should `LIGHTDASH_PROJECT` be used as a default project for project-scoped MCP tools, or should it remain CLI-only semantics?
7. Should hosted OAuth mode support a tool allowlist/denylist in addition to safety mode?
8. What is the intended package name: `@lightdash-tools/mcp` or a future `@dbt-tools/mcp`?

---

## 19. Recommended Next Implementation Tasks

### Task 1: Config and Env Refactor

Implement `loadMcpHttpConfig()` with:

- official Lightdash vars,
- new `LIGHTDASH_TOOLS_MCP_*` vars,
- old alias support,
- warnings,
- Zod validation.

### Task 2: Client Auth Union

Extend `@lightdash-tools/client` so the same typed client can call Lightdash using either:

- PAT/API-key auth, or
- OAuth bearer-token auth.

### Task 3: Context-Based MCP Tools

Refactor MCP tool registration from concrete `LightdashClient` to `McpContextProvider`.

This is the highest-impact code change and should be done before adding more OAuth protocol features.

### Task 4: OAuth HTTP Mode

Add:

- protected-resource metadata,
- bearer middleware,
- `WWW-Authenticate`,
- token validation,
- session token-hash binding.

### Task 5: Docs and E2E

Document:

- local STDIO,
- remote OAuth,
- shared-key compatibility,
- Cloud Run,
- Cursor setup,
- environment variable migration,
- security checklist.

---

## 20. Appendix: Proposed File-Level Changes

### `packages/client/src/config.ts`

- Add `LightdashAuthConfig`.
- Add `auth?: LightdashAuthConfig` to partial config.
- Keep `personalAccessToken` as backward-compatible input.
- Normalize into required `auth`.

### `packages/client/src/utils/env.ts`

- Keep `LIGHTDASH_URL`, `LIGHTDASH_API_KEY`, `LIGHTDASH_PROXY_AUTHORIZATION`.
- Continue using these as official Lightdash env vars.
- Normalize env into `auth: { type: 'api-key' }`.

### `packages/client/src/http/interceptors.ts`

- Switch on `config.auth.type`.
- Emit either `ApiKey` or `Bearer`.

### `packages/mcp/src/config.ts`

- Move old config logic into new config modules or keep as compatibility re-export.
- Replace direct `process.env.MCP_*` reads with `loadMcpHttpConfig()`.

### `packages/mcp/src/server.ts`

Current:

```ts
export function createLightdashMcpServer(
  client: LightdashClient,
  options?: RegisterCapabilitiesOptions,
): McpServer;
```

New:

```ts
export function createLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer;
```

### `packages/mcp/src/capabilities.ts`

Current:

```ts
registerCapabilities(server, client, options);
```

New:

```ts
registerCapabilities(server, contextProvider, options);
```

### `packages/mcp/src/tools/index.ts`

Current:

```ts
registerTools(server, client);
```

New:

```ts
registerTools(server, contextProvider);
```

### `packages/mcp/src/tools/*.ts`

Change each handler to call:

```ts
const { lightdashClient } = await contextProvider.getContext(extra);
```

### `packages/mcp/src/http.ts`

Refactor:

- Use `loadMcpHttpConfig()`.
- Route metadata endpoints before auth.
- Apply selected auth mode.
- Create request/session context.
- Bind sessions to token hash in OAuth mode.

---

## 21. References

- Lightdash CLI environment variables: `https://docs.lightdash.com/references/lightdash-cli#environment-variables`
- MCP Authorization specification, 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`
- `yu-iskw/lightdash-tools` inspected files:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `README.md`
  - `packages/mcp/package.json`
  - `packages/mcp/README.md`
  - `packages/mcp/src/index.ts`
  - `packages/mcp/src/bin.ts`
  - `packages/mcp/src/http.ts`
  - `packages/mcp/src/config.ts`
  - `packages/mcp/src/server.ts`
  - `packages/mcp/src/capabilities.ts`
  - `packages/mcp/src/tools/index.ts`
  - `packages/mcp/src/tools/shared.ts`
  - `packages/common/src/env.ts`
  - `packages/common/src/safety.ts`
  - `packages/client/src/config.ts`
  - `packages/client/src/utils/env.ts`
  - `packages/client/src/client.ts`
  - `packages/client/src/http/axios-client.ts`
  - `packages/client/src/http/interceptors.ts`
- `yu-iskw/lightdash-mcp-demo` inspected files:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `packages/mcp-server/package.json`
  - `packages/mcp-server/src/index.ts`
  - `packages/mcp-server/src/config.ts`
  - `packages/mcp-server/src/middleware/require-bearer.ts`
  - `packages/mcp-server/src/lightdash/oauth-metadata.ts`
  - `packages/mcp-server/src/lightdash/client.ts`
  - `packages/mcp-server/src/mcp/create-server.ts`
