# @lightdash-tools

TypeScript monorepo: Lightdash API client, CLI, and MCP server.

## Using the tools

All tools are available as npm packages under the `@lightdash-tools` scope.

- **HTTP client** ([packages/client/README.md](packages/client/README.md)) — Type-safe Lightdash API client with rate limiting, retries, and shared types. Install via [`npm install @lightdash-tools/client`](https://www.npmjs.com/package/@lightdash-tools/client). <!-- markdown-link-check-disable-line -->
- **CLI** ([packages/cli/README.md](packages/cli/README.md)) — Command-line interface for Lightdash. Run directly via [`npx @lightdash-tools/cli`](https://www.npmjs.com/package/@lightdash-tools/cli) or install globally via `npm install -g @lightdash-tools/cli`. <!-- markdown-link-check-disable-line -->
- **MCP** ([packages/mcp/README.md](packages/mcp/README.md)) — MCP server that exposes Lightdash as tools for AI assistants. Run directly via [`npx @lightdash-tools/mcp`](https://www.npmjs.com/package/@lightdash-tools/mcp). <!-- markdown-link-check-disable-line -->

Developing? See [CONTRIBUTING.md](CONTRIBUTING.md). For agent instructions see [AGENTS.md](AGENTS.md). For architectural decisions, see [docs/adr/](docs/adr/).

## License

Apache-2.0
