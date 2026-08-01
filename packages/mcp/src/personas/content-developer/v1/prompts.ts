/**
 * MCP prompts for content-developer workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import {
  CONTENT_DEVELOPER_HARD_BANS,
  CONTENT_DEVELOPER_PLAYBOOK_MIME,
  CONTENT_DEVELOPER_PLAYBOOK_URI,
  getPlaybookMarkdown,
} from './resources/playbook.js';

import type { McpServer } from '@modelcontextprotocol/server';

function playbookEmbeddedResource() {
  return {
    type: 'resource' as const,
    resource: {
      uri: CONTENT_DEVELOPER_PLAYBOOK_URI,
      mimeType: CONTENT_DEVELOPER_PLAYBOOK_MIME,
      text: getPlaybookMarkdown(),
    },
  };
}

function userMessages(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
      {
        role: 'user' as const,
        content: playbookEmbeddedResource(),
      },
    ],
  };
}

const PREVIEW_VALIDATE_APPLY = `Hard rule: preview -> validate/confirm -> apply. Call the matching lightdash_preview_* tool first,
record the previewId. For updates to an existing chart/dashboard, validate with lightdash_validate_chart /
lightdash_validate_dashboard using that resource's UUID. For creates, duplicates, tile ops, space edits, or
content moves (no existing uuid to validate against), call lightdash_confirm_preview with the same previewId and
the exact resourceKind/resourceKey the preview was created with. Then apply with the write tool using that
previewId. Never call a write tool without a fresh, validated previewId bound to that exact resource.`;

export function registerContentDeveloperPrompts(server: McpServer): void {
  server.registerPrompt(
    'create_dashboard',
    {
      title: 'Create dashboard',
      description: 'Create a new dashboard from existing saved charts',
      argsSchema: {
        goal: z.string(),
        spaceUuid: z.string().optional(),
        chartReferences: z.string().optional(),
      },
    },
    ({ goal, spaceUuid, chartReferences }) =>
      userMessages(`Create a new dashboard for this goal:

${goal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Discover candidate charts first with lightdash_search_content / lightdash_get_chart.
Target space: ${spaceUuid ?? '(resolve or ask)'}. Chart hints: ${chartReferences ?? '(none provided)'}.
Preview with lightdash_preview_dashboard_changes (resourceKey 'new'), confirm with lightdash_confirm_preview
(resourceKind 'dashboard', resourceKey 'new'), then apply with lightdash_create_dashboard. For each tile, preview
the resulting tile array with lightdash_preview_dashboard_changes, confirm_preview, then apply with
lightdash_add_dashboard_tile. Report the dashboard UUID/slug and tiles added.`),
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
      userMessages(`Improve dashboard ${dashboardUuidOrSlug} for this goal:

${improvementGoal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Inspect current structure with lightdash_get_dashboard first.
Preview with lightdash_preview_dashboard_changes, validate with lightdash_validate_dashboard,
then apply with lightdash_update_dashboard and/or the tile tools (lightdash_add_dashboard_tile,
lightdash_move_dashboard_tile, lightdash_remove_dashboard_tile, lightdash_resize_dashboard_tile).
Report what changed and any remaining validation warnings.`),
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
      userMessages(`Refactor dashboard ${dashboardUuidOrSlug}.

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Concern: ${concern ?? '(general cleanup)'}.
Use lightdash_compare_dashboard_versions to understand recent drift before proposing changes.
Preview with lightdash_preview_dashboard_changes, validate, then apply with lightdash_update_dashboard
and the tile tools as needed. Do not remove tiles unless explicitly requested.`),
  );

  server.registerPrompt(
    'build_chart',
    {
      title: 'Build chart',
      description: 'Create or update a semantic chart from an explore',
      argsSchema: {
        goal: z.string(),
        chartUuidOrSlug: z.string().optional(),
        exploreHint: z.string().optional(),
      },
    },
    ({ goal, chartUuidOrSlug, exploreHint }) =>
      userMessages(`${chartUuidOrSlug ? `Update chart ${chartUuidOrSlug}` : 'Build a new chart'} for this goal:

${goal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Explore hint: ${exploreHint ?? '(resolve from goal)'}.
Only semantic (as-code) charts are supported; SQL chart authoring is banned.
Preview with lightdash_preview_chart_changes. ${
        chartUuidOrSlug
          ? 'Validate with lightdash_validate_chart (this chart UUID) since it updates an existing chart, then apply with lightdash_update_chart.'
          : "Confirm with lightdash_confirm_preview (resourceKind 'chart', resourceKey matching the preview's slug) since it creates a new chart, then apply with lightdash_create_chart."
      } Report the chart UUID/slug.`),
  );

  server.registerPrompt(
    'reorganize_spaces',
    {
      title: 'Reorganize spaces',
      description: 'Reorganize spaces and move content between them',
      argsSchema: {
        goal: z.string(),
        spaceReferences: z.string().optional(),
      },
    },
    ({ goal, spaceReferences }) =>
      userMessages(`Reorganize project spaces for this goal:

${goal}

${CONTENT_DEVELOPER_HARD_BANS}

${PREVIEW_VALIDATE_APPLY}

Space hints: ${spaceReferences ?? '(discover with lightdash_list_spaces)'}.
Inspect current structure with lightdash_list_spaces / lightdash_get_space.
Preview with lightdash_preview_space_changes, confirm with lightdash_confirm_preview (resourceKind 'space' or
'content-move', matching resourceKey), then apply with lightdash_create_space / lightdash_update_space, and move
content between spaces with lightdash_move_content. Report the resulting space tree and moved items.`),
  );

  server.registerPrompt(
    'publish_content',
    {
      title: 'Publish content',
      description: 'Validate and finalize authored content before treating it as done',
      argsSchema: {
        contentReferences: z.string(),
      },
    },
    ({ contentReferences }) =>
      userMessages(`Finalize and validate this authored Lightdash content before considering it done:

${contentReferences}

${CONTENT_DEVELOPER_HARD_BANS}

Run lightdash_validate_chart / lightdash_validate_dashboard on every touched chart and dashboard.
Do not report success while validation errors remain outstanding.
Summarize validation results, remaining warnings, and content UUIDs/slugs touched.
This persona cannot promote, publish permissions, or perform org-level release actions;
those remain outside this tool surface.`),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
