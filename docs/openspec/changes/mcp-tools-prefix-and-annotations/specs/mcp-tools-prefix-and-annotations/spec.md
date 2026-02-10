# Spec: MCP tool naming prefix and annotations

## ADDED Requirements

### Requirement: Tool name prefix

All MCP tool names SHALL use the prefix `lightdash_tools__`. The shared registration helper SHALL accept a short name (e.g. `list_charts`) and register the tool under the full name `TOOL_PREFIX + shortName`.

#### Scenario: Prefix applied to every tool

- **WHEN** a tool is registered via the shared helper with short name `list_charts`
- **THEN** the tool SHALL appear in `tools/list` with name `lightdash_tools__list_charts`

#### Scenario: Short names only at call sites

- **WHEN** domain modules register tools
- **THEN** they SHALL pass only the short name to the shared helper; the helper SHALL build the full name internally

### Requirement: Tool annotations

Tool definitions SHALL support optional `title` and `annotations` (readOnlyHint, destructiveHint, idempotentHint, openWorldHint). Default annotations SHALL be applied in the shared helper; per-tool options SHALL override defaults.

#### Scenario: Default annotations for read-only tools

- **WHEN** a tool is registered without explicit annotations
- **THEN** the helper SHALL apply defaults: readOnlyHint true, openWorldHint false (and omit or set destructiveHint/idempotentHint as appropriate)

#### Scenario: Per-tool override

- **WHEN** a tool is registered with explicit `annotations: { readOnlyHint: false }`
- **THEN** the registered tool SHALL use readOnlyHint false; other annotation defaults may still apply

#### Scenario: Human-readable title

- **WHEN** a tool is registered with optional `title` (e.g. "List charts")
- **THEN** the tool definition SHALL include that title for client display; when omitted, clients may use the tool name
