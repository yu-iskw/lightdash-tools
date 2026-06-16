# Secrets and Credentials

This document describes how to securely provide credentials to the Lightdash CLI and MCP server. In the AI era, plaintext `.env` files are a significant risk—AI agents with file access can read them. We recommend env-only credentials and, when file-based config is needed, [dotenvx](https://dotenvx.com/) for encrypted secrets.

## Recommended: Environment Variables from Parent Process

Set credentials via environment variables injected by your parent process. The tools read only from `process.env`; they do not load `.env` files.

**Why env-only?**

- Secrets stay in process memory; AI agents with file access cannot read them from disk.
- CI, Kubernetes, systemd, and other platforms inject env vars securely.
- No plaintext secrets on disk.

**Required variables (STDIO and PAT-based HTTP):**

| Variable            | Description                                                      |
| :------------------ | :--------------------------------------------------------------- |
| `LIGHTDASH_URL`     | Lightdash instance base URL (e.g. `https://app.lightdash.cloud`) |
| `LIGHTDASH_API_KEY` | Personal access token (PAT) or API key                           |

`LIGHTDASH_API_KEY` is **not required** when running Streamable HTTP with `LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth`. In that mode, each MCP user authenticates with their own Lightdash OAuth access token; the server does not hold a shared PAT. See [mcp-oauth-http.md](mcp-oauth-http.md).

**Optional (CLI, STDIO, and all MCP modes):**

| Variable                           | Description                                                        |
| :--------------------------------- | :----------------------------------------------------------------- |
| `LIGHTDASH_PROXY_AUTHORIZATION`    | Proxy authorization header                                         |
| `LIGHTDASH_TOOLS_SAFETY_MODE`      | Safety mode (`read-only`, `write-idempotent`, `write-destructive`) |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` | Comma-separated project UUIDs to restrict operations               |
| `LIGHTDASH_TOOLS_DRY_RUN`          | Set to `1`, `true`, or `yes` to simulate mutating operations       |
| `LIGHTDASH_TOOLS_AUDIT_LOG`        | File path for audit log; unset defaults to stderr                  |

**Streamable HTTP only (`LIGHTDASH_TOOLS_MCP_*`):**

Preferred names use the `LIGHTDASH_TOOLS_MCP_*` prefix per [ADR-0035](adr/0035-environment-variables-prefix-lightdash-tools.md). Legacy `MCP_*` aliases still work with deprecation warnings. Full tables and migration guide: [mcp-oauth-http.md](mcp-oauth-http.md).

| Variable                                                | Description                                                                                            |
| :------------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_TOOLS_MCP_AUTH_MODE`                         | `none` (default), `shared-key`, or `lightdash-oauth`                                                   |
| `LIGHTDASH_TOOLS_MCP_HTTP_HOST`                         | HTTP bind host (default `0.0.0.0`)                                                                     |
| `LIGHTDASH_TOOLS_MCP_HTTP_PORT`                         | HTTP port (default `3100`). Aliases: `MCP_HTTP_PORT`, `MCP_SERVER_PORT`                                |
| `LIGHTDASH_TOOLS_MCP_PUBLIC_URL`                        | Public HTTPS base URL for OAuth metadata (required in `lightdash-oauth` mode). Alias: `MCP_PUBLIC_URL` |
| `LIGHTDASH_TOOLS_MCP_PATH`                              | MCP endpoint path (default `/mcp`)                                                                     |
| `LIGHTDASH_TOOLS_MCP_SHARED_KEY`                        | Shared endpoint secret for `shared-key` mode. Alias: `MCP_API_KEY`                                     |
| `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`                   | Comma-separated CORS origin allowlist. Alias: `MCP_ALLOWED_ORIGINS`                                    |
| `LIGHTDASH_TOOLS_MCP_MAX_BODY_BYTES`                    | Maximum JSON body size. Alias: `MCP_MAX_BODY_BYTES`                                                    |
| `LIGHTDASH_TOOLS_MCP_SESSION_TTL_MS`                    | Session TTL for stateful HTTP. Alias: `MCP_SESSION_TTL_MS`                                             |
| `LIGHTDASH_TOOLS_MCP_MAX_SESSIONS`                      | Maximum active sessions. Alias: `MCP_MAX_SESSIONS`                                                     |
| `LIGHTDASH_TOOLS_MCP_SESSION_CLEANUP_MS`                | Session cleanup interval. Alias: `MCP_SESSION_CLEANUP_MS`                                              |
| `LIGHTDASH_TOOLS_MCP_REQUIRED_SCOPES`                   | Optional endpoint scope requirements in `WWW-Authenticate` (default empty)                             |
| `LIGHTDASH_TOOLS_MCP_SCOPES_SUPPORTED`                  | Scopes in protected-resource metadata (default `read,write,mcp:read,mcp:write`)                        |
| `LIGHTDASH_TOOLS_MCP_VALIDATE_TOKEN`                    | Validate bearer via `GET /api/v1/user` (default on in OAuth mode; `false` is dev-only)                 |
| `LIGHTDASH_TOOLS_MCP_DANGEROUSLY_SKIP_TOKEN_VALIDATION` | Set to `1` to allow `VALIDATE_TOKEN=false` outside `NODE_ENV=development` (not recommended)            |
| `LIGHTDASH_TOOLS_MCP_ALLOW_INSECURE_PUBLIC_URL`         | Set to `1` to allow non-HTTPS `PUBLIC_URL` outside localhost (not recommended)                         |
| `LIGHTDASH_TOOLS_MCP_TOKEN_VALIDATION_CACHE_TTL_MS`     | Token validation cache TTL (default `30000` ms)                                                        |

OAuth client credentials (Client ID/Secret) for MCP **clients** such as Cursor belong in the client's `mcp.json` or environment — not on the MCP server. The server does not use `LIGHTDASH_OAUTH_CLIENT_SECRET`.

**Examples:**

```bash
# Shell
export LIGHTDASH_URL=https://app.lightdash.cloud
export LIGHTDASH_API_KEY=your-pat-token
lightdash-ai projects list
```

```yaml
# GitHub Actions
env:
  LIGHTDASH_URL: ${{ secrets.LIGHTDASH_URL }}
  LIGHTDASH_API_KEY: ${{ secrets.LIGHTDASH_API_KEY }}
run: npx @lightdash-tools/cli projects list
```

## If You Use .env Files: Use dotenvx

If you prefer file-based configuration:

- **Do not use plaintext `.env`.** AI agents with file access can read plaintext secrets.
- **Use [dotenvx](https://dotenvx.com/)** to encrypt your `.env` file. dotenvx uses ECIES encryption; the private key is stored separately from the encrypted file.
- **Run via `dotenvx run`** so dotenvx decrypts and injects env vars before starting the tools:

```bash
# Install dotenvx: npm install -g @dotenvx/dotenvx
dotenvx run -- lightdash-ai projects list
dotenvx run -- lightdash-mcp
```

The encrypted `.env` can be committed to version control; the private decryption key (`DOTENV_PRIVATE_KEY`) must be kept secure and injected via your environment (e.g. CI secrets, secret manager).

## Discouraged: Plaintext .env with dotenv

Using `dotenv` or similar to load a plaintext `.env` file is discouraged when AI agents have file access. Plaintext secrets on disk can be read by agents, accidentally committed, or exposed in prompts. Prefer env injection or dotenvx instead.
