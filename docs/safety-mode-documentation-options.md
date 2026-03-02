# Safety-Mode Documentation Options (APIs, CLI Subcommands, MCP Tools)

## Scope and safety modes

This document compares 5 concrete ways to document safety coverage across:

- Lightdash API domains used by this repository
- CLI command/subcommand groups
- MCP tool modules

Safety modes in scope:

- `read-only`
- `write-idempotent`
- `write-destructive`

## Current coverage snapshot (from code)

### API domains represented in CLI/MCP

| API domain | CLI command area | MCP tool area |
| --- | --- | --- |
| AI agents | `agents`, `ai-agents` | `ai-agents` |
| Charts | `charts` | `charts` |
| Content | `content` | `content` |
| Dashboards | `dashboards` | `dashboards` |
| Explores | `explores` | `explores` |
| Groups | `groups` | `groups` |
| Metrics | `metrics` | `metrics` |
| Projects | `projects`, `project-access`, `project-role-assignments` | `projects` |
| Query | `query` | `query` |
| Schedulers | `schedulers` | `schedulers` |
| Spaces | `spaces`, `space-access` | `spaces` |
| Tags | `tags` | `tags` |
| Users | `users` | `users` |
| Organization | `organization`, `organization-roles` | (n/a) |

### CLI command module safety coverage (derived from `wrapAction(...)`)

| CLI module | Available safety annotations |
| --- | --- |
| `agents.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `ai-agents.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `charts.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `content.ts` | `READ_ONLY_DEFAULT` |
| `dashboards.ts` | `READ_ONLY_DEFAULT` |
| `explores.ts` | `READ_ONLY_DEFAULT` |
| `groups.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `metrics.ts` | `READ_ONLY_DEFAULT` |
| `organization-roles.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `organization.ts` | `READ_ONLY_DEFAULT` |
| `project-access.ts` | `READ_ONLY_DEFAULT` |
| `project-role-assignments.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `projects.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `query.ts` | `READ_ONLY_DEFAULT` |
| `schedulers.ts` | `READ_ONLY_DEFAULT` |
| `space-access.ts` | `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `spaces.ts` | `READ_ONLY_DEFAULT` |
| `tags.ts` | `READ_ONLY_DEFAULT` |
| `users.ts` | `READ_ONLY_DEFAULT` |

### MCP tool module safety coverage (derived from `registerToolSafe(... annotations: ...)`)

| MCP module | Available safety annotations |
| --- | --- |
| `ai-agents.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `charts.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `content.ts` | `READ_ONLY_DEFAULT` |
| `dashboards.ts` | `READ_ONLY_DEFAULT` |
| `explores.ts` | `READ_ONLY_DEFAULT` |
| `groups.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `metrics.ts` | `READ_ONLY_DEFAULT` |
| `projects.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT` |
| `query.ts` | `READ_ONLY_DEFAULT` |
| `schedulers.ts` | `READ_ONLY_DEFAULT` |
| `spaces.ts` | `READ_ONLY_DEFAULT`, `WRITE_IDEMPOTENT`, `WRITE_DESTRUCTIVE` |
| `tags.ts` | `READ_ONLY_DEFAULT` |
| `users.ts` | `READ_ONLY_DEFAULT`, `WRITE_DESTRUCTIVE` |

## Five solution options with scoring

Scoring is from 0 (worst) to 100 (best).

### Evaluation criteria

- **Accuracy/Drift resistance (35%)**
- **Developer usability (25%)**
- **Implementation effort (15%)**
- **Maintenance cost (15%)**
- **CI friendliness/automation fit (10%)**

### Option 1 — Static hand-maintained Markdown matrix

- Keep one manually updated document (like this file) with API/CLI/MCP tables.
- Good for readability, weak against drift.

| Perspective | Score |
| --- | ---: |
| Accuracy/Drift resistance | 55 |
| Developer usability | 90 |
| Implementation effort | 95 |
| Maintenance cost | 60 |
| CI friendliness | 65 |
| **Weighted total** | **71** |

### Option 2 — Generated Markdown from code parsing script (recommended)

- Add a small script that scans `wrapAction(...)` and `registerToolSafe(...)` usage and regenerates docs.
- Treat the generated table as source-of-truth output committed to git.

| Perspective | Score |
| --- | ---: |
| Accuracy/Drift resistance | 92 |
| Developer usability | 88 |
| Implementation effort | 75 |
| Maintenance cost | 84 |
| CI friendliness | 93 |
| **Weighted total** | **87** |

### Option 3 — Runtime introspection endpoint/command

- Add a CLI command (for example `safety report`) and/or MCP meta tool that emits the live registry and resolved safety mode behavior.
- Very accurate at runtime, but more implementation and test complexity.

| Perspective | Score |
| --- | ---: |
| Accuracy/Drift resistance | 95 |
| Developer usability | 82 |
| Implementation effort | 58 |
| Maintenance cost | 70 |
| CI friendliness | 80 |
| **Weighted total** | **81** |

### Option 4 — Docs-as-spec with test enforcement

- Maintain a curated YAML/JSON spec listing API areas, subcommands, MCP tools, and annotation level.
- Unit test asserts code registrations match spec.

| Perspective | Score |
| --- | ---: |
| Accuracy/Drift resistance | 90 |
| Developer usability | 76 |
| Implementation effort | 62 |
| Maintenance cost | 78 |
| CI friendliness | 90 |
| **Weighted total** | **81** |

### Option 5 — Architecture-focused summary only (high-level list)

- Keep only domain-level summaries (no full per-command/per-tool inventory).
- Fast and simple, but insufficient for operational audits.

| Perspective | Score |
| --- | ---: |
| Accuracy/Drift resistance | 45 |
| Developer usability | 70 |
| Implementation effort | 98 |
| Maintenance cost | 85 |
| CI friendliness | 55 |
| **Weighted total** | **64** |

## Recommendation

Pick **Option 2 (Generated Markdown)** now, with a possible upgrade path to Option 4 later if strict spec enforcement is required.

Why:

1. Strong balance of accuracy and low team friction.
2. Easy to review in pull requests.
3. Integrates naturally with CI (detect drift by checking regenerated output).
