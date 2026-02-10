# Spec: MCP tool full annotation defaults

## ADDED Requirements

### Requirement: Full default annotations for read-only tools

Default annotations applied by the shared registration helper SHALL include `destructiveHint: false` and `idempotentHint: true` in addition to existing `readOnlyHint: true` and `openWorldHint: false`, so all five MCP tool annotations are explicit for read-only tools.

#### Scenario: tools/list includes full annotations

- **WHEN** a client sends `tools/list`
- **THEN** each tool definition SHALL include annotations with readOnlyHint true, openWorldHint false, destructiveHint false, and idempotentHint true (unless overridden per-tool)

#### Scenario: Single source of truth

- **WHEN** a new read-only tool is registered without explicit annotations
- **THEN** it SHALL receive the full default annotations from `DEFAULT_ANNOTATIONS` in shared.ts
