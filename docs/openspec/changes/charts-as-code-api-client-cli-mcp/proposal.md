# Proposal: Charts-as-code API in client, CLI, and MCP

## Why

The Lightdash API exposes charts-as-code endpoints (`GET /api/v1/projects/{projectUuid}/charts/code`, `POST .../charts/{slug}/code`) that exist in the OpenAPI spec and back the "dashboards as code" / "charts as code" workflow in Lightdash docs. These are not exposed in our three main surfaces: the HTTP client (`@lightdash-tools/client`), the CLI (`@lightdash-tools/cli`), and the MCP server (`@lightdash-tools/mcp`). Users and automations cannot list or upsert chart code programmatically, via CLI, or through MCP tools without using raw HTTP.

## What Changes

- **Client**: Extend `ChartsClient` (v1) with `getChartsAsCode(projectUuid, options?)` and `upsertChartAsCode(projectUuid, slug, body)`. Use OpenAPI types for request/response.
- **CLI**: Add under `projects charts` a `code` subcommand group with `list <projectUuid>` and `upsert <projectUuid> <slug>` (body from `--file` or stdin). Output JSON.
- **MCP**: Add `list_charts_as_code` and `upsert_chart_as_code` tools that call the client and return JSON.

**NON-BREAKING**: All changes are additive. No existing APIs or commands are removed or changed.

## Capabilities

### New Capabilities

- **client.v1.charts**: Get charts as code (with optional ids, offset, languageMap) and upsert a chart from code representation.
- **CLI**: `projects charts code list` and `projects charts code upsert` for charts-as-code workflows from the command line.
- **MCP**: `list_charts_as_code` and `upsert_chart_as_code` for AI agents and tooling to get and update chart definitions as code.

## Impact

- **Code**: Extend `packages/client/src/api/v1/charts.ts`; extend `packages/cli/src/commands/charts.ts`; extend `packages/mcp/src/tools/charts.ts`. No new top-level modules; wiring already exists.
- **User Experience**: Users can list and upsert charts as code from scripts, CLI, and MCP (e.g. Cursor + MCP for AI-assisted chart development).
- **Developer Experience**: Single pattern (typed client); types from OpenAPI.

## References

- ADR-0023: Support Lightdash charts-as-code API across client, CLI, and MCP
- GitHub Issue: [#53](https://github.com/yu-iskw/lightdash-tools/issues/53) <!-- markdown-link-check-disable-line -->
