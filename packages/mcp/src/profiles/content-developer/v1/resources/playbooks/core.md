# Content-developer core

URI: `lightdash://playbooks/content-developer/core`

## Purpose

Author **semantic** charts and dashboards inside one resolved project. **Clarify objective → Design Spec → user approval →** create the dashboard shell first, then create charts scoped with `dashboardSlug` (official Lightdash as-code: dashboard-owned charts do not appear as independent space charts). Every write is gated: `preview_*` → `confirm_preview` → apply.

this profile does **not** execute queries, compile explores, create spaces, or promote. Clone viz configs via `get_chart_as_code` / `duplicate_chart`. For unknown fieldIds use semantic-layer. For promote use content-governance.

## Hard bans

- Do not execute arbitrary metric queries, raw SQL, warehouse runs, or saved-chart execution (no `run_chart` here).
- Do not author or upsert SQL charts.
- Do not hard-delete, rollback, or promote content. Promote dashboards via **content-governance**.
- Do not perform organization administration or list org-wide projects.
- Do not create or update spaces — spaces are Terraform / out-of-band. Use existing spaces only.
- Do not create **space-only** charts for dashboard work (omit `dashboardSlug`). New charts must set `dashboardSlug` to the dashboard already created.
- Do not call `preview_*` or write tools for a **new** dashboard or a **material** dashboard redesign until a Design Spec (with settled **Objective**) was presented and the user approved or amended it in-thread.
- Do not start writes from a viz-type / “all chart types” checklist alone — Objective and insight questions come first (an explicit user all-types ask may be the Objective after a one-line restatement).
- Do not call `confirm_preview` without **`projectUuid`** when there is no HTTP pin — `PROJECT_SCOPE_REQUIRED` even if the matching `preview_*` already had a project.
- Do not attach dashboard filters whose `target.tableName` is absent from a tile’s explore without explicitly excluding that tile (or remapping) via `tileTargets`.
- Do not treat chart create as done without a dashboard shell and tiles that reference those charts.
- Do not invent `fieldId`s. Copy from `get_chart_as_code` / `get_chart` (`includeQueryDefinition`) or semantic-layer.
- Do not invent skinny `chartConfig` (e.g. `{ series: [{ type: 'bar' }] }` only) — clone a working as-code body and keep series/layout/encode structure.
- Do not call a write tool without a validated, unexpired HMAC `previewToken` from the matching `preview_*` then `confirm_preview`.
- Do not mutate the proposed payload after `preview_*` (no edits to `description`, `name`, SQL, metrics, tiles, or other fields between preview and apply) — apply must reuse the **identical proposed** body or you get `PREVIEW_STALE` (content hash mismatch). Any intentional edit requires a new `preview_*`.
- Do not reuse a **draft** token after confirm (confirm returns a **new** validated token) or after payload/baseline drift (`PREVIEW_STALE`).
- Do not unlock with a different resource's preview — `resourceKind` / `resourceKey` must match the preview exactly.
- Do not treat `validate_chart` / `validate_dashboard` as unlock — saved-UUID health checks only (not UI-render proof).
- Do not reveal secrets, warehouse credentials, or hidden SQL.

## Default budgets (override when the user expands scope)

| Resource                                            | Default                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `search_content` pages                              | `pageSize≤25`, stop after **2** pages                                            |
| Spaces deep-dived (`get_space`)                     | **≤3**                                                                           |
| Seed charts inspected / cloned                      | **≤12**                                                                          |
| New charts created per dashboard                    | **≤8** (raise only when the user explicitly expands scope, e.g. all chart types) |
| Concurrent preview→confirm→apply chains             | **≤2** (hosted tunnels often 502 under heavier parallelism)                      |
| Tile mutations after shell                          | Prefer one `update_dashboard` with full tiles; else **≤8** `add_dashboard_tile`  |
| Preview→confirm→apply retries after `PREVIEW_STALE` | **≤2** per resource                                                              |

Record when a budget stopped you. User-requested “one of every chart type” overrides the new-chart cap.

## Allowed tools (`lightdash_*`)

| Tool                                                                                             | Use for                                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `get_project`                                                                                    | Resolve project; read `developerCapabilities` (mutate yes; **execute charts/tiles = false**)     |
| `search_content`                                                                                 | Find charts/dashboards; prefer short tokens, not marketing phrases                               |
| `list_spaces` / `get_space`                                                                      | Existing spaces; pick `spaceUuid` / `spaceSlug`                                                  |
| `get_dashboard` / `get_chart`                                                                    | Metadata. `get_chart` arg is **`chartUuidOrSlug`** (not `chartUuid`). Tiles often omit `x/y/w/h` |
| `get_chart_as_code`                                                                              | **Clone** upsert-shaped `chartConfig` + `metricQuery` before create/update                       |
| `preview_chart_changes` / `preview_dashboard_changes` / `preview_content_move`                   | Mint draft `previewToken` + `resourceKey`                                                        |
| `confirm_preview`                                                                                | Unlock; returns **new** validated token — always pass **`projectUuid`** without HTTP pin         |
| `create_chart` / `update_chart` / `duplicate_chart`                                              | Semantic as-code writes (after confirm); set `dashboardSlug`                                     |
| `create_dashboard` / `update_dashboard` / `duplicate_dashboard`                                  | Dashboard shell then tile updates                                                                |
| `add_dashboard_tile` / `move_dashboard_tile` / `remove_dashboard_tile` / `resize_dashboard_tile` | Tile ops; each needs preview of the **full next tiles array**                                    |
| `move_content`                                                                                   | Relocate into existing spaces                                                                    |
| `validate_chart` / `validate_dashboard`                                                          | Optional post-apply health (`chartUuid` / dashboard UUID)                                        |
| `compare_chart_versions` / `compare_dashboard_versions`                                          | Drift / refactor                                                                                 |

## Phase 0 — Resolve project

1. Always pass **`projectUuid`** (or HTTP `X-Lightdash-Project` pin). Else `PROJECT_SCOPE_REQUIRED` — stop.
2. Call `get_project`. Record UUID, name, pin, and `developerCapabilities`.
3. Expect execution capabilities **false** — you cannot verify query results here.
4. Never switch projects or invent an org project list.
5. Shared discovery tools (`get_dashboard`, `get_chart`, …) report `context.profile: content-developer` on this server — same serving profile as write tools.

## Preview → confirm → apply (every write)

1. `preview_*` → record `previewToken`, `previewId`, `contentHash`, `resourceKey`, `expiresAt`, diff. Treat the proposed `changes` / nested `chart` / `dashboard` object as **immutable** until apply succeeds.
2. `confirm_preview` with that draft token + exact `resourceKind` / `resourceKey` **and `projectUuid` (required when there is no HTTP pin)** → use the **returned** validated `previewToken`. Omitting `projectUuid` on confirm yields `PROJECT_SCOPE_REQUIRED` even if preview succeeded with a project arg.
3. Apply write with the validated token, **`projectUuid`**, and the **identical proposed payload** (`dashboard:{}` / `chart:{}` nested shapes). Do **not** tidy `description`/`name`/SQL/tiles between confirm and apply — that causes `PREVIEW_STALE` (`content hash does not match the applied payload`). Keep one proposed object and reuse it; any edit → new `preview_*`.
4. Failure taxonomy (re-preview → confirm → apply, ≤2 retries per resource):
   - Apply body ≠ preview → **`PREVIEW_STALE`** (`content hash` mismatch).
   - Resource `updatedAt` / create race → **`PREVIEW_STALE`** (baseline changed).
   - Token expired (~10 min TTL) or invalid → **`PREVIEW_REQUIRED`** (“invalid or expired”) — not a separate `PREVIEW_EXPIRED` code.
5. Optionally `validate_*` on saved UUIDs. Report UUIDs/slugs — never claim success without a successful apply response. UI render is not guaranteed by MCP success alone.

**Diff noise vs real omissions:** On dashboard **update** previews, `diff.removed` often lists server-owned metadata omitted from the proposal (`access`, `views`, `updatedAt`, `uuid`, `slug`, `organizationUuid`, …). Ignore those. If **`tiles`**, **`tabs`**, or **`filters`** appear in `diff.removed`, you omitted them from `changes` — do **not** apply. Re-preview with the full intentional `tiles`/`tabs`/`filters` (copy layout from preview `current` when only editing name/description). Never ship a description-only body that drops the board.

### ResourceKey cheat sheet

| Operation           | Typical `resourceKind` | Typical `resourceKey`                                                    |
| ------------------- | ---------------------- | ------------------------------------------------------------------------ |
| Create chart        | `chart`                | target **`slug`** — only if `preview_chart_changes` got top-level `slug` |
| Update chart        | `chart`                | chart **UUID** (slug is alias)                                           |
| Duplicate chart     | `chart`                | **source** UUID                                                          |
| Create dashboard    | `dashboard`            | literal `new`                                                            |
| Update / tile ops   | `dashboard`            | dashboard UUID (slug is alias)                                           |
| Duplicate dashboard | `dashboard`            | **source** UUID                                                          |
| Content move        | `content-move`         | preview's `resourceKey`                                                  |

**Create-chart gotcha:** omit top-level `slug` on `preview_chart_changes` → preview returns `resourceKey: "new"`, but `create_chart` applies with `resourceKey = args.slug` → binding mismatch. Always pass top-level `slug` (same as `changes.slug`) on create previews.

### Apply arg pitfalls

- `preview_*` uses flat `changes`; `create_dashboard` / `update_dashboard` wrap the **same** body as `dashboard: { … }`; `create_chart` / `update_chart` wrap as `chart: { … }` plus top-level `slug`.
- `create_chart` requires top-level **`slug`** **and** `chart.slug` (same value).
- Charts use **`spaceSlug`** (+ `skipSpaceCreate: true`) and **`dashboardSlug`** for dashboard-owned charts.
- Dashboards use **`spaceUuid`** (not `spaceSlug`).
- `dashboardSlug` owns the chart to the dashboard but does **not** add tiles — still `update_dashboard` with a full tile array.
- Tile shape: `{ type: 'saved_chart', x, y, w, h, properties: { savedChartUuid, title? } }` — use the UUID from `create_chart` / `duplicate_chart` (36-column grid; half-width ≈ `w: 18`). Optional `chartSlug` is metadata only; do not omit `savedChartUuid`.
- `create_chart` response: extract UUID from `charts[0].data.uuid` (not a bare chart object).
- Viz shapes: `lightdash://playbooks/content-developer/chart-types`.
