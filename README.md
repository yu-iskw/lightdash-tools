# @lightdash-tools

TypeScript monorepo: Lightdash API client, CLI, and MCP server.

## Using the tools

All tools are available as npm packages under the `@lightdash-tools` scope.

- **HTTP client** ([packages/client/README.md](packages/client/README.md)) — Type-safe Lightdash API client with rate limiting, retries, and shared types. Install via [`npm install @lightdash-tools/client`](https://www.npmjs.com/package/@lightdash-tools/client). <!-- markdown-link-check-disable-line -->
- **CLI** ([packages/cli/README.md](packages/cli/README.md)) — Command-line interface for Lightdash. Run directly via [`npx @lightdash-tools/cli`](https://www.npmjs.com/package/@lightdash-tools/cli) or install globally via `npm install -g @lightdash-tools/cli`. <!-- markdown-link-check-disable-line -->
- **MCP** ([packages/mcp/README.md](packages/mcp/README.md)) — MCP server that exposes Lightdash as tools for AI assistants. Run directly via [`npx @lightdash-tools/mcp`](https://www.npmjs.com/package/@lightdash-tools/mcp). <!-- markdown-link-check-disable-line -->

## AI Safety and Agent-Friendly Features

Both the CLI and MCP server implement a hierarchical safety model to prevent accidental destructive operations (see [ADR 0029](docs/adr/0029-hierarchical-safety-modes-for-mcp-and-cli.md)).

You can control the safety level using the `LIGHTDASH_TOOLS_SAFETY_MODE` environment variable:

- `write-destructive`: Allows all operations, including deletions.
- `write-idempotent`: Allows read operations and non-destructive writes (e.g., upsert, validate run).
- `read-only` (default): Only allows non-modifying operations (e.g., list, get).

For the CLI, you can also use the global `--safety-mode` flag.

**Agent-friendly features** (CLI and MCP):

- **Schema introspection** — `lightdash-ai schema list` and `lightdash-ai schema get <resource>` for runtime discoverability.
- **Dry-run** — `--dry-run` or `LIGHTDASH_TOOLS_DRY_RUN=1` to simulate mutating operations without executing.
- **Project allowlist** — `--projects` or `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` to restrict operations to specific projects.
- **Input validation** — Resource IDs are validated; invalid inputs (control chars, `?`, `#`, `%`, path traversal) are rejected before any API call.

For agent-specific guidance, see [docs/agent-context/CONTEXT.md](docs/agent-context/CONTEXT.md). For credentials, use env vars from your shell or CI; see [docs/secrets-and-credentials.md](docs/secrets-and-credentials.md).

Developing? See [CONTRIBUTING.md](CONTRIBUTING.md). For agent instructions see [AGENTS.md](AGENTS.md). For architectural decisions, see [docs/adr/](docs/adr/).

## License

Apache-2.0
