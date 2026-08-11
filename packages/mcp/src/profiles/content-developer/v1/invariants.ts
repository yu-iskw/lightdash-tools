/**
 * Content-developer structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import { formatHardBansProjection, type PromptInvariant } from '../../lib/prompt-invariants.js';

export const CONTENT_DEVELOPER_INVARIANTS = [
  {
    id: 'no-arbitrary-sql',
    severity: 'critical',
    short:
      'Do not execute arbitrary metric queries, raw SQL, warehouse runs, or saved-chart execution.',
  },
  {
    id: 'no-sql-charts',
    severity: 'critical',
    short: 'Do not author or upsert SQL charts.',
  },
  {
    id: 'no-hard-delete-promote',
    severity: 'critical',
    short:
      'Do not hard-delete, rollback, or promote content (use content-governance for promote).',
  },
  {
    id: 'no-org-admin',
    severity: 'critical',
    short: 'Do not perform organization administration or list org-wide projects.',
  },
  {
    id: 'no-space-crud',
    severity: 'critical',
    short:
      'Do not create or update spaces — spaces are Terraform / out-of-band; use existing spaces only.',
  },
  {
    id: 'no-space-only-charts',
    severity: 'critical',
    short:
      'Do not create space-only charts for dashboard work — set dashboardSlug to the dashboard shell already created.',
  },
  {
    id: 'design-approval',
    severity: 'critical',
    short:
      'Do not call preview_* or write tools for a new dashboard or a material dashboard redesign until a Design Spec (with settled Objective) was presented and the user approved or amended it in-thread.',
  },
  {
    id: 'objective-first',
    severity: 'critical',
    short:
      'Do not start writes from a viz-type or all-chart-types checklist alone — settle Objective and insight questions first (an explicit user all-types ask may be the Objective after a one-line restatement).',
  },
  {
    id: 'project-scope',
    severity: 'critical',
    short:
      'Do not call confirm_preview without projectUuid when there is no HTTP X-Lightdash-Project pin (PROJECT_SCOPE_REQUIRED).',
  },
  {
    id: 'tile-targets-filters',
    severity: 'critical',
    short:
      'Do not attach dashboard filters whose target.tableName is absent from a tile explore without excluding that tile (or remapping) via tileTargets.',
  },
  {
    id: 'dashboard-shell-first',
    severity: 'critical',
    short: 'Do not treat chart create as done without a dashboard shell and tiles.',
  },
  {
    id: 'no-invent-field-ids',
    severity: 'critical',
    short:
      'Do not invent fieldIds — clone via get_chart_as_code / get_chart or use semantic-layer.',
  },
  {
    id: 'no-skinny-chart-config',
    severity: 'critical',
    short:
      'Do not invent skinny chartConfig — clone a working as-code body and keep series/layout/encode.',
  },
  {
    id: 'no-verify-unless-asked',
    severity: 'critical',
    short:
      'Do not set chart verified or dashboard preserveVerification unless the user explicitly asks (verify permission required).',
  },
  {
    id: 'preview-confirm-apply',
    severity: 'critical',
    short:
      'Do not apply a write tool without a confirmed, unexpired HMAC previewToken from the matching preview_* tool (confirm_preview unlocks every write; use the new validated token).',
  },
  {
    id: 'immutable-preview-payload',
    severity: 'critical',
    short:
      'Do not mutate the proposed payload after preview_* (description/name/SQL/metrics/tiles) — apply must reuse the identical proposed body or PREVIEW_STALE (content hash mismatch); any edit requires a new preview_*.',
  },
  {
    id: 'validate-not-unlock',
    severity: 'critical',
    short:
      'Do not treat validate_chart / validate_dashboard as a preview unlock — they are saved-UUID health checks only (validate_chart needs chartUuid).',
  },
  {
    id: 'no-reuse-draft-token',
    severity: 'critical',
    short:
      'Do not reuse a draft previewToken after confirm; re-run preview if the resource drifts (PREVIEW_STALE).',
  },
  {
    id: 'no-sdd-mcp-click-loops',
    severity: 'critical',
    short:
      'Do not use subagent-driven-development or multi-task writing-plans solely to click MCP preview/confirm/apply for lab boards (e.g. experiments) — after Design Spec approval, run Batch SOP inline in the same session.',
  },
  {
    id: 'no-secrets',
    severity: 'critical',
    short: 'Do not reveal secrets, warehouse credentials, or saved SQL chart bodies.',
  },
] as const satisfies readonly PromptInvariant[];

export const CONTENT_DEVELOPER_HARD_BANS = formatHardBansProjection(CONTENT_DEVELOPER_INVARIANTS);

/** All critical invariants — eager in every policy (compact has no core embed). */
export const CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS = CONTENT_DEVELOPER_INVARIANTS.map(
  (inv) => inv.id,
) as unknown as ReadonlyArray<(typeof CONTENT_DEVELOPER_INVARIANTS)[number]['id']>;
