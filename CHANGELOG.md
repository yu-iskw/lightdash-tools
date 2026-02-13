# Changelog

## [0.2.1] - 2026-02-13

### Features

- Implemented hierarchical safety modes (`read-only`, `write-idempotent`, `write-destructive`) for both CLI and MCP server.
- Added support for `LIGHTDASH_AI_MODE` environment variable and `--mode` global CLI flag to enforce safety guardrails.
- Integrated tool annotations (`readOnlyHint`, `destructiveHint`) to automatically filter and block operations based on the active safety mode.
- Added comprehensive unit and integration tests for safety enforcement.

## [0.2.0] - 2026-02-13

### Features

- Added support for project validation API (`validate_project`, `get_validation_results`).
- Added support for metrics data catalog API (`list_metrics`).
- Added support for scheduled deliveries API (`list_schedulers`).
- Added support for project tags API (`list_tags`).
- Added support for v2 content search API (`search_content`).
- Added support for explore dimensions and field lineage (`list_dimensions`, `get_field_lineage`).
- Enhanced CLI with new commands: `projects validate`, `metrics`, `schedulers`, `tags`, `content`, and `explores dimensions/lineage`.
- Expanded TypeScript client with new API modules and improved type safety.

## [0.1.2] - 2026-02-13

## [0.1.0] - 2026-02-12

## [v0.1.0] - 2026-02-11
