# @lightdash-tools

TypeScript monorepo: Lightdash API client, CLI, and MCP server.

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/)
- Node.js (see `.node-version`)
- [Trunk](https://trunk.io/) (for linting and formatting)

### Installation

#### Install Trunk

On macOS, you can install Trunk using Homebrew:

```bash
brew install trunk-io
```

For other platforms, see the [Trunk installation guide](https://docs.trunk.io/references/cli/getting-started/install).

#### Install Dependencies

```bash
pnpm install
trunk install
```

### Development

```bash
pnpm dev
```

### Agent Instructions

For shared agent and contributor instructions (setup, commands, workflow, subagents, and key skills), see [AGENTS.md](AGENTS.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

### Build

```bash
pnpm build
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

## Project Structure

- `packages/`: Monorepo packages
  - `cli/`: CLI for Lightdash APIs
  - `client/`: HTTP client for Lightdash APIs
  - `common/`: Shared types and utilities
  - `mcp/`: MCP server exposing Lightdash tools

## License

Apache-2.0
