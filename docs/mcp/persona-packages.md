# Persona-Specific MCP Packages (Stdio)

Lightdash Tools provides **persona-specific MCP packages** as the primary mechanism for narrowing what AI agents can _discover_ and _invoke_.

## Package is the exposure boundary

In MCP, tool visibility is determined by what the server registers. These persona packages curate that registration:

- If a tool is **not registered** by the persona package, it will **not appear** in `tools/list` for that MCP server.
- Package authors implement narrow tool registration using the composable `register*Tool` exports from `@lightdash-tools/mcp`.

This is an additional boundary on top of the existing defense-in-depth guardrails:

- safety mode (`LIGHTDASH_TOOLS_SAFETY_MODE`)
- project allowlists (`LIGHTDASH_TOOLS_ALLOWED_PROJECTS`)
- dry-run for writes (`LIGHTDASH_TOOLS_DRY_RUN`)
- structured audit logging (`LIGHTDASH_TOOLS_AUDIT_LOG`)
- Lightdash backend authorization

## Official packages (v1)

- `@lightdash-tools/mcp-agent-viewer` — read-oriented exploration and metadata inspection.
- `@lightdash-tools/mcp-agent-developer` — developer workflows with carefully curated idempotent/non-destructive writes.

## Example MCP client configuration (stdio)

Most MCP clients support process-per-client stdio servers. Example (generic `mcp` client config shape):

```json
{
  "mcpServers": {
    "lightdash-viewer": {
      "command": "npx",
      "args": ["-y", "@lightdash-tools/mcp-agent-viewer"],
      "env": {
        "LIGHTDASH_URL": "https://app.lightdash.cloud",
        "LIGHTDASH_API_KEY": "${LIGHTDASH_API_KEY}",
        "LIGHTDASH_TOOLS_SAFETY_MODE": "read-only",
        "LIGHTDASH_TOOLS_ALLOWED_PROJECTS": "project-uuid-1,project-uuid-2",
        "LIGHTDASH_TOOLS_AUDIT_LOG": "/var/log/lightdash-viewer.ndjson"
      }
    }
  }
}
```

## Security caveat: PAT scope is unchanged

Persona packages narrow MCP tool exposure, but they **do not** modify Lightdash PAT scopes or backend permissions.

Use the smallest feasible Lightdash user/PAT and project allowlists in addition to persona packages.
