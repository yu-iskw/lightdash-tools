# Contributing

Thanks for your interest in contributing. This guide covers the basics; for the full command list, code style, and tooling see [AGENTS.md](AGENTS.md).

## Prerequisites

- [pnpm](https://pnpm.io/)
- Node.js (see [.node-version](.node-version))
- [Trunk](https://trunk.io/) (for linting and formatting)

## Setup

```bash
pnpm install
trunk install
```

## Before committing

Run lint and tests:

```bash
pnpm lint && pnpm test
```

## Branch and commits

- Create feature branches from `main`.
- Use conventional commits: `type(scope): description` (e.g. `feat(ui): add button`).
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Pull requests

- Ensure `pnpm lint` and `pnpm test` pass.
- If you touch package names or add packages, run `pnpm validate:names` before submitting.

## ADRs, changelog, and OpenSpec

- **ADRs**: Stored in [docs/adr](docs/adr). Use the `manage-adr` skill when `adr-tools` is available.
- **Changelog**: Managed with [Changie](https://github.com/miniscruff/changie). Use the `manage-changelog` skill when `changie` is available.
- **OpenSpec**: Spec-driven changes live under [docs/openspec](docs/openspec). Run the CLI from `docs/` or `pnpm openspec --` from the repo root.

For full workflow details, subagents, and skills see [AGENTS.md](AGENTS.md).
