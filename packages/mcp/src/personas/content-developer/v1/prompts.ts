/**
 * MCP prompts for content-developer workflows.
 *
 * Procedure detail lives in playbooks (embedded via createPromptPlaybookEmbedder).
 * Prompt bodies stay goal/input-specific — do not restate core/dashboard SOPs here.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import { projectUuidField } from '../../../tools/lib/schema-fields.js';
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

const optionalProjectUuid = projectUuidField().optional();

const PROJECT_UUID_HINT = '(pass on every tool, or use HTTP pin — else PROJECT_SCOPE_REQUIRED)';

export function registerContentDeveloperPrompts(server: McpServer): void {
  server.registerPrompt(
    'create_dashboard',
    {
      title: 'Create dashboard',
      description: 'Create a dashboard shell first, then dashboardSlug-scoped charts as tiles',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuid,
        spaceUuid: z.string().optional(),
        chartReferences: z.string().optional(),
      },
    },
    ({ goal, projectUuid, spaceUuid, chartReferences }) =>
      userMessages(
        `Create a new dashboard for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

${CONTENT_DEVELOPER_HARD_BANS}

Target existing space: ${spaceUuid ?? '(resolve with lightdash_list_spaces / lightdash_get_space — never create a space)'}.
Chart hints: ${chartReferences ?? '(none provided)'}.
Follow core + dashboards + dashboard-design playbooks (preview→confirm→apply; shell first; tile after create).
Report dashboard UUID/slug, tiles, and chart UUIDs — reject space-only orphans or untiled dashboard-owned charts.`,
        ['dashboards', 'dashboard-design'],
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
        projectUuid: optionalProjectUuid,
      },
    },
    ({ dashboardUuidOrSlug, improvementGoal, projectUuid }) =>
      userMessages(
        `Improve dashboard ${dashboardUuidOrSlug} for this goal:

${improvementGoal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

${CONTENT_DEVELOPER_HARD_BANS}

Inspect with lightdash_get_dashboard first. Follow core + dashboards + dashboard-design playbooks.
New charts: get_chart_as_code seed + dashboardSlug, then tile — never space-only publishes.
Report what changed and any remaining validation warnings.`,
        ['dashboards', 'dashboard-design'],
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
        projectUuid: optionalProjectUuid,
      },
    },
    ({ dashboardUuidOrSlug, concern, projectUuid }) =>
      userMessages(
        `Refactor dashboard ${dashboardUuidOrSlug}.

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

${CONTENT_DEVELOPER_HARD_BANS}

Concern: ${concern ?? '(general cleanup)'}.
Use lightdash_compare_dashboard_versions before proposing changes. Follow core + dashboards playbooks.
Do not remove tiles unless explicitly requested.`,
        'dashboards',
      ),
  );

  server.registerPrompt(
    'author_chart',
    {
      title: 'Author chart',
      description:
        'Clone a working seed chart (cartesian encode intact); optional dashboardSlug scoping',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuid,
        seedChartUuidOrSlug: z.string().optional(),
        dashboardSlug: z.string().optional(),
      },
    },
    ({ goal, projectUuid, seedChartUuidOrSlug, dashboardSlug }) =>
      userMessages(
        `Author a semantic chart for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.
Seed chart: ${seedChartUuidOrSlug ?? '(find a rendering seed on the same tableName via search_content / get_space)'}.
Dashboard slug: ${dashboardSlug ?? '(omit only for intentional space-owned charts; for dashboard work set dashboardSlug to an existing dashboard shell)'}.

${CONTENT_DEVELOPER_HARD_BANS}

Follow core + chart-types playbooks (clone via get_chart_as_code; preview with top-level slug; tile if dashboardSlug set).
Report UUID/slug; note this persona cannot run_chart / prove UI render.`,
        'chart-types',
      ),
  );

  server.registerPrompt(
    'move_content',
    {
      title: 'Move content',
      description: 'Move charts/dashboards into an existing space (no space create/update)',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuid,
        spaceReferences: z.string().optional(),
      },
    },
    ({ goal, projectUuid, spaceReferences }) =>
      userMessages(
        `Move content between existing spaces for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

${CONTENT_DEVELOPER_HARD_BANS}

Space hints: ${spaceReferences ?? '(discover with lightdash_list_spaces)'}.
Follow core + content-move playbooks. Target spaces must already exist.
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
        projectUuid: optionalProjectUuid,
      },
    },
    ({ contentReferences, projectUuid }) =>
      userMessages(
        `Finalize this authored Lightdash content before considering it done:

${contentReferences}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

${CONTENT_DEVELOPER_HARD_BANS}

Follow core + dashboards playbooks done checklist (dashboardSlug + tiles, encode intact, no invented fieldIds).
Optionally validate_* (schema/health only). Promote is content-governance, not this persona.`,
        'dashboards',
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
