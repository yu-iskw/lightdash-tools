# Secrets and Credentials

This document describes how to securely provide credentials to the Lightdash CLI and MCP server. In the AI era, plaintext `.env` files are a significant risk—AI agents with file access can read them. We recommend env-only credentials and, when file-based config is needed, [dotenvx](https://dotenvx.com/) for encrypted secrets.

## Recommended: Environment Variables from Parent Process

Set credentials via environment variables injected by your parent process. The tools read only from `process.env`; they do not load `.env` files.

**Why env-only?**

- Secrets stay in process memory; AI agents with file access cannot read them from disk.
- CI, Kubernetes, systemd, and other platforms inject env vars securely.
- No plaintext secrets on disk.

**Required variables:**

| Variable            | Description                                                      |
| :------------------ | :--------------------------------------------------------------- |
| `LIGHTDASH_URL`     | Lightdash instance base URL (e.g. `https://app.lightdash.cloud`) |
| `LIGHTDASH_API_KEY` | Personal access token (PAT) or API key                           |

**Optional:**

| Variable                           | Description                                                        |
| :--------------------------------- | :----------------------------------------------------------------- |
| `LIGHTDASH_PROXY_AUTHORIZATION`    | Proxy authorization header                                         |
| `LIGHTDASH_TOOLS_SAFETY_MODE`      | Safety mode (`read-only`, `write-idempotent`, `write-destructive`) |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` | Comma-separated project UUIDs to restrict operations               |
| `LIGHTDASH_TOOLS_DRY_RUN`          | Set to `1`, `true`, or `yes` to simulate mutating operations       |
| `LIGHTDASH_TOOLS_AUDIT_LOG`        | File path for audit log; unset defaults to stderr                  |

See [ADR-0035](adr/0035-environment-variables-prefix-lightdash-tools.md) for the env var naming convention.

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
