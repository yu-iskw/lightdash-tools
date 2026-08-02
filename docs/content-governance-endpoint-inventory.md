# Content-governance endpoint inventory

Capability map for the `content-governance` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`). See [ADR-0015](adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md) for elicitation-required soft-delete and [ADR-0017](adr/0017-mcp-content-governance-dashboard-promote-elicitation-boundary.md) for dashboard promote.

| Capability                 | Method | Path                                                              | Client                                  | Notes                                                                                              |
| -------------------------- | ------ | ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Soft-delete saved chart    | DELETE | `/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}`          | `v2.charts.deleteSavedChart`            | MCP `delete_chart`; form elicitation + signed `requestState` before DELETE; restorable from trash  |
| Soft-delete dashboard      | DELETE | `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}` | `v2.dashboards.deleteDashboard`         | MCP `delete_dashboard`; same confirmation framework as charts                                      |
| Get dashboard promote diff | GET    | `/api/v1/dashboards/{dashboardUuidOrSlug}/promoteDiff`            | `v1.dashboards.getDashboardPromoteDiff` | MCP `get_dashboard_promote_diff` (read-only); optional `projectUuid` query for slug disambiguation |
| Promote dashboard          | POST   | `/api/v1/dashboards/{dashboardUuidOrSlug}/promote`                | `v1.dashboards.promoteDashboard`        | MCP `promote_dashboard`; form elicitation + diff-bound `requestState` before POST                  |
| Get saved chart (pre)      | GET    | `/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}`          | `v2.charts.getSavedChart`               | Used internally to snapshot name/`updatedAt` for confirmation binding (not a persona tool)         |
| Get dashboard (pre)        | GET    | `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}` | `v2.dashboards.getDashboard`            | Same as chart pre-check; also used for promote snapshot                                            |

**Client-only (never MCP):**

| Capability                 | Method | Path                                      | Client                                | Notes                                                        |
| -------------------------- | ------ | ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Permanently delete content | DELETE | `/api/v2/content/{projectUuid}/permanent` | `v2.content.permanentlyDeleteContent` | Irrecoverable; `bannedMcpToolName: permanent_delete_content` |

**Excluded from MCP v1:** bulk delete, space delete, restore APIs as agent tools, org-level deletes, chart/SQL-chart promote tools, boolean/`confirmed: true` shortcuts, prepare/execute tokens without elicitation.

## Soft-delete confirmation protocol

1. Client must declare form elicitation (`elicitation.form` or empty `elicitation: {}`).
2. First `tools/call` → `InputRequiredResult` with flat form (`decision`, `confirmationText`) + opaque `requestState`.
3. Retry with `inputResponses` + echoed `requestState`; accept requires typed resource name match.
4. Server re-fetches the resource; precondition mismatch → `RESOURCE_CHANGED` (no DELETE).
5. Production requires `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` (≥32 bytes).

## Dashboard promote confirmation protocol

1. Same form elicitation capability gate as soft-delete (`ELICITATION_REQUIRED` when missing).
2. Optional inspection via `get_dashboard_promote_diff` before calling `promote_dashboard`.
3. First `promote_dashboard` call fetches dashboard + `promoteDiff`, then returns `InputRequiredResult` with `decision: confirm_promote | do_not_promote`, typed dashboard name, and a message summarizing `PromotionChanges` counts plus upstream-overwrite consequences.
4. On accept, server re-fetches dashboard + promoteDiff; digest mismatch → `RESOURCE_CHANGED` (no POST).
5. Upstream project is the Data Ops setting on the source project — tools do not accept a free-form target project UUID.
6. Dashboard promote may create/update nested charts, spaces, and data-app tiles in upstream.
