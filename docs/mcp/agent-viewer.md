# `@lightdash-tools/mcp-agent-viewer`

## Purpose

An MCP server for **read-only** Lightdash exploration workflows:

- list and inspect projects, charts, dashboards, spaces
- search content
- inspect explores/fields lineage
- inspect metrics/tags
- compile queries (without executing them)

## Exposed MCP tools (`ldt__*`)

- `ldt__list_projects`, `ldt__get_project`, `ldt__get_validation_results`
- `ldt__list_charts`, `ldt__list_charts_as_code`
- `ldt__list_dashboards`
- `ldt__list_spaces`, `ldt__get_space`
- `ldt__search_content`
- `ldt__list_explores`, `ldt__get_explore`, `ldt__list_dimensions`, `ldt__get_field_lineage`
- `ldt__list_metrics`
- `ldt__list_tags`
- `ldt__compile_query`
- `ldt__list_schedulers`

## Recommended environment variables

```bash
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
LIGHTDASH_TOOLS_ALLOWED_PROJECTS=project-uuid-1,project-uuid-2
LIGHTDASH_TOOLS_AUDIT_LOG=/var/log/lightdash-agent-viewer.ndjson
```

## Example (stdio)

```bash
LIGHTDASH_URL="https://app.lightdash.cloud" \
LIGHTDASH_API_KEY="$LIGHTDASH_API_KEY" \
LIGHTDASH_TOOLS_SAFETY_MODE="read-only" \
LIGHTDASH_TOOLS_ALLOWED_PROJECTS="project-uuid-1" \
npx -y @lightdash-tools/mcp-agent-viewer
```

## Security note

Persona package visibility is necessary but not sufficient. It narrows _what the agent can see/call_, not what the PAT can do in Lightdash.
