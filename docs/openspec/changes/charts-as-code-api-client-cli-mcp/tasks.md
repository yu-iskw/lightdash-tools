# Tasks: Charts-as-code API in client, CLI, and MCP

## Phase 1: HTTP client (packages/client)

- [x] 1.1 Extend `packages/client/src/api/v1/charts.ts`: add `getChartsAsCode(projectUuid, options?)` and `upsertChartAsCode(projectUuid, slug, body)`. Use GET `/projects/{projectUuid}/charts/code` and POST `/projects/{projectUuid}/charts/{slug}/code`. Use types from common/openapi (ApiChartAsCodeListResponse, ApiChartAsCodeUpsertResponse, upsert body).
- [x] 1.2 Add or extend `packages/client/src/api/v1/charts.test.ts`: tests that assert getChartsAsCode and upsertChartAsCode call the correct path and method (mock HTTP). Follow explores.test.ts or query.test.ts pattern.
- [x] 1.3 Run `pnpm build` from repo root; fix any type errors.

## Phase 2: CLI (packages/cli)

- [x] 2.1 Extend `packages/cli/src/commands/charts.ts`: add `code` subcommand group with `list <projectUuid>` and `upsert <projectUuid> <slug>`. List calls `client.v1.charts.getChartsAsCode`; upsert reads body from `--file` or stdin and calls `client.v1.charts.upsertChartAsCode`. Output JSON.
- [x] 2.2 Ensure `packages/cli/src/index.ts` registers charts command (no change if already under projects).
- [x] 2.3 Add or extend CLI tests for `projects charts code list` and `projects charts code upsert`.
- [x] 2.4 Run `pnpm build`, `pnpm test`, `pnpm lint`.

## Phase 3: MCP (packages/mcp)

- [x] 3.1 Extend `packages/mcp/src/tools/charts.ts`: register `list_charts_as_code` (input projectUuid, optional ids) and `upsert_chart_as_code` (inputs projectUuid, slug, chart). Use wrapTool and registerToolSafe; call client.v1.charts and return JSON text.
- [x] 3.2 Confirm `packages/mcp/src/tools/index.ts` calls registerChartTools (no change if already registered).
- [x] 3.3 Run `pnpm build`, `pnpm test`, `pnpm lint`.

## Phase 4: Changelog (after Phases 1–3 complete)

- [x] 4.1 Add changelog fragments (feat) for client, CLI, and MCP using manage-changelog. Then batch release / merge into CHANGELOG per the skill.
- [x] 4.2 Update issue status to Done (delegate to github-project-manager). Mark OpenSpec tasks complete.
