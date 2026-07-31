# @lightdash-tools

TypeScript monorepo: Lightdash API client, CLI, and MCP server.

## Using the tools

All tools are available as npm packages under the `@lightdash-tools` scope.

- **HTTP client** ([packages/client/README.md](packages/client/README.md)) — Type-safe Lightdash API client with rate limiting, retries, and shared types. Install via [`npm install @lightdash-tools/client`](https://www.npmjs.com/package/@lightdash-tools/client). <!-- markdown-link-check-disable-line -->
- **CLI** ([packages/cli/README.md](packages/cli/README.md)) — Command-line interface for Lightdash. Run directly via [`npx @lightdash-tools/cli`](https://www.npmjs.com/package/@lightdash-tools/cli) or install globally via `npm install -g @lightdash-tools/cli`. <!-- markdown-link-check-disable-line -->
- **MCP** ([packages/mcp/README.md](packages/mcp/README.md)) — MCP server that exposes Lightdash as tools for AI assistants. Run directly via [`npx @lightdash-tools/mcp`](https://www.npmjs.com/package/@lightdash-tools/mcp). <!-- markdown-link-check-disable-line -->

## AI Safety and Agent-Friendly Features

**CLI** uses a hierarchical safety stack ([ADR-0005](docs/adr/0005-cli-safety-stack.md)): `LIGHTDASH_TOOLS_SAFETY_MODE` / `--safety-mode` (`read-only` default, `write-idempotent`, `write-destructive`), plus optional dry-run, project allowlist, and audit log.

**MCP** is persona-first ([ADR-0008](docs/adr/0008-mcp-request-scope-and-hardening.md)): capability = persona `toolIds`; HTTP may pin via `X-Lightdash-Project`; process safety-mode / allowlist / dry-run are **not** used on MCP.

**Shared agent-friendly features:**

- **Agent-safe surface** — Irrecoverable ops stay off MCP/CLI ([ADR-0004](docs/adr/0004-agent-safe-exposure-mcp-cli-vs-client-only.md)).
- **Input validation** — Known identifier fields only (`projectUuid`, `slug`, …).
- **Audit log** — Optional `LIGHTDASH_TOOLS_AUDIT_LOG`.

For agent-specific guidance, see [docs/agent-context/CONTEXT.md](docs/agent-context/CONTEXT.md). For credentials, use env vars from your shell or CI; see [docs/secrets-and-credentials.md](docs/secrets-and-credentials.md).

Developing? See [CONTRIBUTING.md](CONTRIBUTING.md). For agent instructions see [AGENTS.md](AGENTS.md). For architectural decisions, see [docs/adr/](docs/adr/).

## License

Apache-2.0
