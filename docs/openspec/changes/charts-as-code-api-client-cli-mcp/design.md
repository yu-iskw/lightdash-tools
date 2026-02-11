# Design: Charts-as-code API in client, CLI, and MCP

## Context

- The Lightdash v1 API exposes `GET /api/v1/projects/{projectUuid}/charts/code` (get charts as code) and `POST /api/v1/projects/{projectUuid}/charts/{slug}/code` (upsert chart as code). Response types are `ApiChartAsCodeListResponse` and `ApiChartAsCodeUpsertResponse` in the OpenAPI-generated types.
- The client package has `ChartsClient` (v1) under `client.v1.charts` with only `listCharts(projectUuid)` today. CLI exposes `projects charts list`; MCP has `list_charts`.
- We extend the existing ChartsClient and charts command/tools rather than introducing new top-level modules.

## Goals / Non-Goals

**Goals:**

- Add getChartsAsCode and upsertChartAsCode to ChartsClient; no change to client.ts wiring (ChartsClient already registered).
- Add CLI subcommand group `projects charts code` with `list` and `upsert`.
- Add MCP tools `list_charts_as_code` and `upsert_chart_as_code` in the existing charts tools module.

**Non-Goals:**

- Dashboards as code, SQL charts as code (out of scope for this change). Document as future work if needed.

## Decisions

### Decision 1: Client

**Choice:** Extend `packages/client/src/api/v1/charts.ts` with:

- `getChartsAsCode(projectUuid: string, options?: { ids?: string[]; offset?: number; languageMap?: boolean })` → GET `/projects/{projectUuid}/charts/code` with query params, return type ApiChartAsCodeListResponse (or equivalent from common).
- `upsertChartAsCode(projectUuid: string, slug: string, body: UpsertChartAsCodeBody)` → POST `/projects/{projectUuid}/charts/${slug}/code` with JSON body, return type ApiChartAsCodeUpsertResponse.

Types: use generated types from `packages/common` (components.schemas). Optionally re-export or alias in common/src/types/charts.ts for a cleaner public API.

**Rationale:** Same pattern as ExploresClient (list/get); keeps all chart operations on ChartsClient.

### Decision 2: CLI

**Choice:** Extend `packages/cli/src/commands/charts.ts`. Find the existing `projects` command and the `charts` subcommand; add `chartsCmd.command('code')` with subcommands:

- `list <projectUuid>`: call `client.v1.charts.getChartsAsCode(projectUuid)`; optional flags `--ids`, `--offset`, `--language-map`; output JSON.
- `upsert <projectUuid> <slug>`: read body from `--file <path>` or stdin (e.g. readFileSync or getStdin); parse JSON; call `client.v1.charts.upsertChartAsCode(projectUuid, slug, body)`; output JSON.

**Rationale:** Matches explores and query command structure; code is a subdomain under charts.

### Decision 3: MCP

**Choice:** Extend `packages/mcp/src/tools/charts.ts`. Register two additional tools:

- `list_charts_as_code`: input schema `{ projectUuid: z.string(), ids: z.array(z.string()).optional() }`; call `client.v1.charts.getChartsAsCode(projectUuid, { ids })`; return JSON text.
- `upsert_chart_as_code`: input schema `{ projectUuid: z.string(), slug: z.string(), chart: z.record(z.unknown()) }` (or a more specific schema if desired); call `client.v1.charts.upsertChartAsCode(projectUuid, slug, chart)`; return JSON text.

Use existing `wrapTool` and `registerToolSafe` from shared. No change to tools index beyond the extended registerChartTools.

**Rationale:** Same pattern as explores tools; keeps chart tools in one module.

## Command tree (CLI)

```
lightdash-tools
├── ...
├── projects charts list <projectUuid>
├── projects charts code list <projectUuid>
├── projects charts code upsert <projectUuid> <slug>
└── ...
```

## Risks / Trade-offs

- **Upsert body shape**: The OpenAPI body is complex (Omit*ChartAsCode.chartConfig-or-description* + description + chartConfig + flags). Client accepts a type that matches the API; CLI/MCP pass through JSON. Validation beyond TypeScript may be limited until the API returns an error.
- **Types in common**: Client can import from generated openapi-types; we may add minimal re-exports in common/src/types/charts.ts for ApiChartAsCodeListResponse and the upsert body/response if we want a single public namespace.
