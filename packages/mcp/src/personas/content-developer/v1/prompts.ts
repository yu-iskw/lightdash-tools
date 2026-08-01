/**
 * MCP prompts for content-developer workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_HARD_BANS,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: CONTENT_DEVELOPER_CORE_PLAYBOOK,
  topics: CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
});

const PREVIEW_VALIDATE_APPLY = `Hard rule: preview -> validate/confirm -> apply. Call the matching lightdash_preview_* tool first,
record the previewId. For updates to an existing chart/dashboard, validate with lightdash_validate_chart /
lightdash_validate_dashboard using that resource's UUID. For creates, duplicates, tile ops, or
content moves (no existing uuid to validate against), call lightdash_confirm_preview with the same previewId and
the exact resourceKind/resourceKey the preview was created with. Then apply with the write tool using that
previewId. Never call a write tool without a fresh, validated previewId bound to that exact resource.`;

const DASHBOARD_FIRST = `Dashboard-first: the dashboard is the authoring and promotion unit. Create/update charts only as
tile prerequisites in this workflow; every new chart must be added as a dashboard tile before treating work as done.
Do not create or update spaces (Terraform / out-of-band) — place content in an existing spaceUuid from list_spaces/get_space.
Promote via UI dashboard promote only (not MCP).`;

export function registerContentDeveloperPrompts(server: McpServer): void {
  server.registerPrompt(
    'create_dashboard',
    {
      title: 'Create dashboard',
      description:
        'Create a dashboard in an existing space, authoring charts only as tiles on that dashboard',
      argsSchema: {
        goal: z.string(),
        spaceUuid: z.string().optional(),
        chartReferences: z.string().optional(),
      },
    },
    ({ goal, spaceUuid, chartReferences }) =>
      userMessages(
        `Create a new dashboard for this goal:

${goal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

${DASHBOARD_FIRST}

Target existing space: ${spaceUuid ?? '(resolve with lightdash_list_spaces / lightdash_get_space — never create a space)'}.
Chart hints: ${chartReferences ?? '(none provided)'}.
Discover reusable charts with lightdash_search_content / lightdash_get_chart.
If a new semantic chart is required, preview_chart_changes → confirm_preview → create_chart, then immediately
preview_dashboard_changes / add_dashboard_tile so the chart is on this dashboard.
Preview dashboard create with lightdash_preview_dashboard_changes (resourceKey 'new'), confirm with
lightdash_confirm_preview (resourceKind 'dashboard', resourceKey 'new'), apply with lightdash_create_dashboard.
For each tile, preview the tile array, confirm_preview, then lightdash_add_dashboard_tile.
Report dashboard UUID/slug, tiles, and chart UUIDs — do not stop at orphan charts.`,
        'dashboards',
      ),
  );

  server.registerPrompt(
    'improve_dashboard',
    {
      title: 'Improve dashboard',
      description: 'Improve an existing dashboard (layout, filters, or tile set)',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        improvementGoal: z.string(),
      },
    },
    ({ dashboardUuidOrSlug, improvementGoal }) =>
      userMessages(
        `Improve dashboard ${dashboardUuidOrSlug} for this goal:

${improvementGoal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

${DASHBOARD_FIRST}

Inspect current structure with lightdash_get_dashboard first.
If new charts are needed, author them as tile prerequisites then add tiles — never as a standalone publish.
Preview with lightdash_preview_dashboard_changes, validate with lightdash_validate_dashboard,
then apply with lightdash_update_dashboard and/or the tile tools (lightdash_add_dashboard_tile,
lightdash_move_dashboard_tile, lightdash_remove_dashboard_tile, lightdash_resize_dashboard_tile).
Report what changed and any remaining validation warnings.`,
        'dashboards',
      ),
  );

  server.registerPrompt(
    'refactor_dashboard',
    {
      title: 'Refactor dashboard',
      description: 'Refactor a dashboard by comparing versions and reconciling drift',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        concern: z.string().optional(),
      },
    },
    ({ dashboardUuidOrSlug, concern }) =>
      userMessages(
        `Refactor dashboard ${dashboardUuidOrSlug}.

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

${DASHBOARD_FIRST}

Concern: ${concern ?? '(general cleanup)'}.
Use lightdash_compare_dashboard_versions to understand recent drift before proposing changes.
Preview with lightdash_preview_dashboard_changes, validate, then apply with lightdash_update_dashboard
and the tile tools as needed. Do not remove tiles unless explicitly requested.`,
        'dashboards',
      ),
  );

  server.registerPrompt(
    'move_content',
    {
      title: 'Move content',
      description: 'Move charts/dashboards into an existing space (no space create/update)',
      argsSchema: {
        goal: z.string(),
        spaceReferences: z.string().optional(),
      },
    },
    ({ goal, spaceReferences }) =>
      userMessages(
        `Move content between existing spaces for this goal:

${goal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Space hints: ${spaceReferences ?? '(discover with lightdash_list_spaces)'}.
Inspect with lightdash_list_spaces / lightdash_get_space. Target spaces must already exist —
do not call create_space or update_space (not available; Terraform / out-of-band).
Preview with lightdash_preview_content_move using itemUuids + targetSpaceUuid + contentTypes,
confirm with lightdash_confirm_preview (resourceKind 'content-move'), then apply with lightdash_move_content.
Report moved items and target space.`,
        'content-move',
      ),
  );

  server.registerPrompt(
    'publish_content',
    {
      title: 'Publish content',
      description: 'Validate dashboard-scoped authored content before treating it as done',
      argsSchema: {
        contentReferences: z.string(),
      },
    },
    ({ contentReferences }) =>
      userMessages(
        `Finalize and validate this authored Lightdash content before considering it done:

${contentReferences}

${CONTENT_DEVELOPER_HARD_BANS}

${DASHBOARD_FIRST}

Run lightdash_validate_chart / lightdash_validate_dashboard on every touched chart and dashboard.
Every new/updated chart must appear on a dashboard tile — reject orphan chart-only done states.
Do not report success while validation errors remain outstanding.
Summarize validation results, remaining warnings, dashboard and chart UUIDs/slugs touched.
This persona cannot promote, publish permissions, or perform org-level release actions;
operators should use UI dashboard promote when promoting across projects.`,
        'dashboards',
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
