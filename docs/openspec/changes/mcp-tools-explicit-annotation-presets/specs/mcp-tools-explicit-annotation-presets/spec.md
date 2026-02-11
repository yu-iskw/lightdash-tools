# Spec: MCP tool explicit annotation presets at call site

## ADDED Requirements

### Requirement: Exported presets in shared.ts

[packages/mcp/src/tools/shared.ts](../../../../../packages/mcp/src/tools/shared.ts) SHALL export `READ_ONLY_DEFAULT` and `WRITE_IDEMPOTENT` as `ToolAnnotations` objects. READ_ONLY_DEFAULT SHALL have readOnlyHint true, openWorldHint false, destructiveHint false, idempotentHint true. WRITE_IDEMPOTENT SHALL have readOnlyHint false, destructiveHint false, idempotentHint true, openWorldHint false. <!-- markdown-link-check-disable-line -->

### Requirement: Explicit annotations at every tool registration

Every call to `registerToolSafe` SHALL include `annotations: READ_ONLY_DEFAULT` or `annotations: WRITE_IDEMPOTENT` in the options object. Tool modules SHALL import the preset(s) from `./shared.js`.

#### Scenario: Read-only tools use READ_ONLY_DEFAULT

- **WHEN** a tool is read-only (list, get, compile)
- **THEN** its registration SHALL pass `annotations: READ_ONLY_DEFAULT`

#### Scenario: Write idempotent tool uses WRITE_IDEMPOTENT

- **WHEN** the tool is `upsert_chart_as_code`
- **THEN** its registration SHALL pass `annotations: WRITE_IDEMPOTENT`

#### Scenario: mergeAnnotations preserves overrides

- **WHEN** options.annotations is a preset (or partial override)
- **THEN** `mergeAnnotations(options.annotations)` SHALL produce the final annotations (preset values or override wins over internal default).
