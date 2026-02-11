# Handoff: GitHub issues for MCP explicit annotation presets

**Default GitHub Project:** owner yu-iskw, project #3 (lightdash-tools).

## Issue created and status updated

- **Issue #54:** [MCP tools: explicit annotation presets at call site for visibility](https://github.com/yu-iskw/lightdash-tools/issues/54) <!-- markdown-link-check-disable-line -->
- Added to project 3; Status set to **Done**.
- Comment added summarizing completed work (ADR-0024, OpenSpec, implementation, changelog, verify).

---

## Phase 0.1: Create issues (if not yet created)

### Parent issue

- **Title:** MCP tools: explicit annotation presets at call site for visibility
- **Body:**

  Make MCP tool hints visible and transparent at each tool definition by using explicit annotation presets at every `registerToolSafe` call (READ_ONLY_DEFAULT, WRITE_IDEMPOTENT). Only `upsert_chart_as_code` is a write tool; all others are read-only. ADR: docs/adr/0024-explicit-mcp-tool-annotation-presets-at-call-site-for-visibility.md. OpenSpec: docs/openspec/changes/mcp-tools-explicit-annotation-presets/.

### Sub-issues (link each to parent; add all to project)

1. **ADR/OpenSpec** – Create ADR and OpenSpec change for explicit annotation presets.
2. **Implementation** – Add shared presets and pass `annotations` in every MCP tool.
3. **Changelog** – Add changelog fragment after implementation is complete.

Set initial status (e.g. ADR/OpenSpec "In progress" or "Done" once ADR and OpenSpec exist).

## Phase 2.2: After implementation (closeout)

Implementation is complete. Delegate to github-project-manager to:

- Mark **Changelog** sub-issue Done.
- Mark **Implementation** sub-issue Done (if not already).
- Mark **ADR/OpenSpec** sub-issue Done (if not already).
- Mark **parent issue** Done (or appropriate final status).
- Ensure all related items on the default project reflect final status.
