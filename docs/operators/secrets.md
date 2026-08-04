# Secrets and Credentials

How to securely provide credentials to the Lightdash CLI and MCP server. Prefer env-only credentials; when file-based config is needed, use [dotenvx](https://dotenvx.com/docs/quickstart/encryption) encryption.

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

`LIGHTDASH_API_KEY` is **not required** for primary hosted OAuth HTTP (server-held `LIGHTDASH_TOOLS_OAUTH_CLIENT_*`). It remains required for stdio, shared-key, and local unauthenticated HTTP. Full MCP OAuth env table: [mcp-oauth.md](mcp-oauth.md).

**Optional (CLI primarily; audit also used by MCP):**

| Variable                                | Description                                                                                                                                                            |
| :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIGHTDASH_PROXY_AUTHORIZATION`         | Proxy authorization header                                                                                                                                             |
| `LIGHTDASH_TOOLS_SAFETY_MODE`           | CLI only — safety mode (`read-only`, `write-idempotent`, `write-destructive`)                                                                                          |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` | CLI + MCP — comma-separated project UUIDs (ceiling; unset = unrestricted)                                                                                              |
| `LIGHTDASH_TOOLS_DRY_RUN`               | CLI only — set to `1`, `true`, or `yes` to simulate mutating operations                                                                                                |
| `LIGHTDASH_TOOLS_AUDIT_LOG`             | Optional file path for NDJSON audit append (CLI/local). Unset → stderr as pure JSON (`channel: "audit"`). On Cloud Run leave unset — see [cloud-run.md](cloud-run.md). |

OAuth client id/secret belong on the **MCP server** only — never in Cursor/Claude `mcp.json`. Obsolete `AUTH_MODE` / `DANGEROUSLY_*` / `EXPERIMENTAL_*` / `INSECURE_DEV` / `LIGHTDASH_TOOLS_MCP_PATH` are **rejected** at startup.

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
- **Use [dotenvx](https://dotenvx.com/docs/quickstart/encryption)** to encrypt your `.env` file. Commit the encrypted file; do **not** commit `.env.keys`.
- **Run via `dotenvx run`** so dotenvx decrypts and injects env vars before starting the tools:

```bash
# Install dotenvx: npm install -g @dotenvx/dotenvx
dotenvx run -- lightdash-ai projects list
dotenvx run -- lightdash-mcp stdio --profile semantic-layer
```

The private decryption key (`DOTENV_PRIVATE_KEY`) must be kept secure and injected via your environment (e.g. CI secrets, secret manager). Locally, `dotenvx run` can read it from `.env.keys`.

## Discouraged: Plaintext .env with dotenv

Using `dotenv` or similar to load a plaintext `.env` file is discouraged when AI agents have file access. Plaintext secrets on disk can be read by agents, accidentally committed, or exposed in prompts. Prefer env injection or dotenvx instead.
