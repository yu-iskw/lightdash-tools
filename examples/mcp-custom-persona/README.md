# @acme/lightdash-mcp-finance-viewer (example)

This is a minimal example of an OSS persona MCP package for Lightdash.

## What it exposes

- `ldt__list_projects`
- `ldt__get_project`
- `ldt__list_charts`
- `ldt__search_content`

Everything else is intentionally not registered.

## Run (stdio)

Set standard Lightdash environment variables and start the stdio server:

```bash
export LIGHTDASH_URL="https://app.lightdash.cloud"
export LIGHTDASH_API_KEY="$LIGHTDASH_API_KEY"
export LIGHTDASH_TOOLS_SAFETY_MODE="read-only"

npx -y @acme/lightdash-mcp-finance-viewer
```
