# Content-governance endpoint inventory

Capability map for the `content-governance` MCP persona (OpenAPI pin in `config/lightdash-openapi-ref.txt`). See [ADR-0015](adr/0015-mcp-content-governance-persona-elicitation-required-soft-delete-boundary.md) for the elicitation-required soft-delete boundary.

| Capability              | Method | Path                                                              | Client                          | Notes                                                                                           |
| ----------------------- | ------ | ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Soft-delete saved chart | DELETE | `/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}`          | `v2.charts.deleteSavedChart`    | MCP `delete_chart`; form elicitation + AEAD `requestState` before DELETE; restorable from trash |
| Soft-delete dashboard   | DELETE | `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}` | `v2.dashboards.deleteDashboard` | MCP `delete_dashboard`; same confirmation framework as charts                                   |
| Get saved chart (pre)   | GET    | `/api/v2/projects/{projectUuid}/saved/{chartUuidOrSlug}`          | `v2.charts.getSavedChart`       | Used internally to snapshot name/`updatedAt` for confirmation binding (not a persona tool)      |
| Get dashboard (pre)     | GET    | `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}` | `v2.dashboards.getDashboard`    | Same as chart pre-check                                                                         |

**Client-only (never MCP):**

| Capability                 | Method | Path                                      | Client                                | Notes                                                        |
| -------------------------- | ------ | ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Permanently delete content | DELETE | `/api/v2/content/{projectUuid}/permanent` | `v2.content.permanentlyDeleteContent` | Irrecoverable; `bannedMcpToolName: permanent_delete_content` |

**Excluded from MCP v1:** bulk delete, space delete, restore APIs as agent tools, org-level deletes, boolean/`confirmed: true` shortcuts, prepare/execute tokens without elicitation.

## Confirmation protocol

1. Client must declare form elicitation (`elicitation.form` or empty `elicitation: {}`).
2. First `tools/call` → `InputRequiredResult` with flat form (`decision`, `confirmationText`) + opaque `requestState`.
3. Retry with `inputResponses` + echoed `requestState`; accept requires typed resource name match.
4. Server re-fetches the resource; precondition mismatch → `RESOURCE_CHANGED` (no DELETE).
5. Production requires `LIGHTDASH_TOOLS_MCP_REQUEST_STATE_KEY` (≥32 bytes).
