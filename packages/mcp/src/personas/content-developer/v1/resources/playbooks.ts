/**
 * Content-developer multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type ContentDeveloperPlaybookTopic =
  'chart-types' | 'content-move' | 'dashboard-design' | 'dashboards';

const playbooks = definePersonaPlaybooks<ContentDeveloperPlaybookTopic>({
  personaId: 'content-developer',
  moduleDir: __dirname,
  hardBans: `Do not execute arbitrary metric queries, raw SQL, warehouse runs, or saved-chart execution.
Do not author or upsert SQL charts.
Do not hard-delete, rollback, or promote content (use content-governance for promote).
Do not perform organization administration or list org-wide projects.
Do not create or update spaces — spaces are Terraform / out-of-band; use existing spaces only.
Do not create space-only charts for dashboard work — set dashboardSlug to the dashboard shell already created.
Do not call preview_* or write tools for a new dashboard or a material dashboard redesign until a Design Spec (with settled Objective) was presented and the user approved or amended it in-thread.
Do not start writes from a viz-type or all-chart-types checklist alone — settle Objective and insight questions first (an explicit user all-types ask may be the Objective after a one-line restatement).
Do not call confirm_preview without projectUuid when there is no HTTP X-Lightdash-Project pin (PROJECT_SCOPE_REQUIRED).
Do not attach dashboard filters whose target.tableName is absent from a tile explore without excluding that tile (or remapping) via tileTargets.
Do not treat chart create as done without a dashboard shell and tiles.
Do not invent fieldIds — clone via get_chart_as_code / get_chart or use semantic-layer.
Do not invent skinny chartConfig — clone a working as-code body and keep series/layout/encode.
Do not apply a write tool without a confirmed, unexpired HMAC previewToken from the matching preview_* tool (confirm_preview unlocks every write; use the new validated token).
Do not mutate the proposed payload after preview_* (description/name/SQL/metrics/tiles) — apply must reuse the identical proposed body or PREVIEW_STALE (content hash mismatch); any edit requires a new preview_*.
Do not treat validate_chart / validate_dashboard as a preview unlock — they are saved-UUID health checks only (validate_chart needs chartUuid).
Do not reuse a draft previewToken after confirm; re-run preview if the resource drifts (PREVIEW_STALE).
Do not use subagent-driven-development or multi-task writing-plans solely to click MCP preview/confirm/apply for lab boards (e.g. experiments) — after Design Spec approval, run Batch SOP inline in the same session.
Do not reveal secrets, warehouse credentials, or hidden SQL.`,
  coreDescription: 'Hard bans, tools, project scope, preview gate, and apply pitfalls',
  topics: [
    {
      id: 'dashboards',
      title: 'Content-developer dashboards playbook',
      description: 'Dashboard shell first, then dashboardSlug-scoped charts as tiles',
      file: 'dashboards.md',
    },
    {
      id: 'dashboard-design',
      title: 'Content-developer dashboard-design playbook',
      description:
        'Objective-first Design Spec, explore↔filter / tileTargets, layout, markdown, filters, tabs',
      file: 'dashboard-design.md',
    },
    {
      id: 'chart-types',
      title: 'Content-developer chart-types playbook',
      description: 'Insight-first viz pick; cartesian encode checklist; UI intent → as-code map',
      file: 'chart-types.md',
    },
    {
      id: 'content-move',
      title: 'Content-developer content-move playbook',
      description: 'Move content into existing spaces (no space CRUD)',
      file: 'content-move.md',
    },
  ],
});

export const CONTENT_DEVELOPER_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_DEVELOPER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_DEVELOPER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerContentDeveloperPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
