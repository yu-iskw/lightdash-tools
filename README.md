# @lightdash-tools

[![SBOM](https://github.com/yu-iskw/lightdash-tools/actions/workflows/sbom.yml/badge.svg)](https://github.com/yu-iskw/lightdash-tools/actions/workflows/sbom.yml)

TypeScript client, CLI, and profile-scoped MCP servers for [Lightdash](https://www.lightdash.com/).

## Choose your tool

All packages are published under the `@lightdash-tools` npm scope.

- **HTTP client** ([packages/client/README.md](packages/client/README.md)) — Type-safe Lightdash API client with rate limiting, retries, and shared types. [`npm install @lightdash-tools/client`](https://www.npmjs.com/package/@lightdash-tools/client). <!-- markdown-link-check-disable-line -->
- **CLI** ([packages/cli/README.md](packages/cli/README.md)) — Command-line interface for Lightdash ops. [`npx @lightdash-tools/cli`](https://www.npmjs.com/package/@lightdash-tools/cli) or `npm install -g @lightdash-tools/cli`. <!-- markdown-link-check-disable-line -->
- **MCP** ([packages/mcp/README.md](packages/mcp/README.md)) — MCP server that exposes Lightdash as tools for AI assistants (seven profiles). [`npx @lightdash-tools/mcp`](https://www.npmjs.com/package/@lightdash-tools/mcp). <!-- markdown-link-check-disable-line -->

## Credentials

Set credentials from the parent process (shell, CI, or MCP client `env`). Create a personal access token in Lightdash under **Settings → Personal Access Tokens**.

| Variable                                | Used by                | Purpose                                                              |
| :-------------------------------------- | :--------------------- | :------------------------------------------------------------------- |
| `LIGHTDASH_URL`                         | Client, CLI, MCP       | Lightdash instance URL (e.g. `https://app.lightdash.cloud`)          |
| `LIGHTDASH_API_KEY`                     | Client, CLI, MCP stdio | Personal access token (PAT)                                          |
| `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` | CLI + MCP              | Optional comma-separated project UUID ceiling (unset = unrestricted) |

Prefer env vars over plaintext `.env` files when agents can read the filesystem. Details: [docs/operators/secrets.md](docs/operators/secrets.md).

## MCP quick start (stdio)

Add a server to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). See [Cursor MCP docs](https://cursor.com/docs/mcp).

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "npx",
      "args": ["-y", "@lightdash-tools/mcp", "stdio", "--profile", "content-reader"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "your_pat"
      }
    }
  }
}
```

Pass `stdio --profile <id>` in `args` (required — there is no default). Other profiles and playbooks: [packages/mcp/README.md](packages/mcp/README.md).

## HTTP MCP

For remote Streamable HTTP (POST-only MCP endpoints, no protocol sessions):

```bash
npx @lightdash-tools/mcp http
```

Hosted OAuth for Cursor (URL-only client config): [docs/operators/cursor-claude.md](docs/operators/cursor-claude.md). Operator setup: [packages/mcp/README.md](packages/mcp/README.md).

## Safety

- **CLI** — hierarchical safety stack: `LIGHTDASH_TOOLS_SAFETY_MODE` / `--safety-mode` (`read-only` default, `write-idempotent`, `write-destructive`), optional dry-run, shared project allowlist, and audit log ([ADR-0005](docs/adr/0005-cli-safety-stack.md)).
- **MCP** — capability is the profile tool surface; optional HTTP pin via `X-Lightdash-Project`; shared `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` ceiling. MCP ignores CLI `SAFETY_MODE` / `DRY_RUN` ([ADR-0008](docs/adr/0008-mcp-request-scope-and-hardening.md)).
- **Agent-safe surface** — irrecoverable ops stay off MCP and CLI; use the client for those ([ADR-0004](docs/adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).

Agent-oriented notes: [docs/operators/agent-context.md](docs/operators/agent-context.md).

## Developing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agent instructions: [AGENTS.md](AGENTS.md). Release notes: [CHANGELOG.md](CHANGELOG.md). ADRs: [docs/adr/](docs/adr/).

## License

Apache-2.0
