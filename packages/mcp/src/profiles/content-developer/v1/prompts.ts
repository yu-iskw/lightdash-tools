/**
 * MCP prompts for content-developer workflows (progressive-disclosure context).
 *
 * Procedure detail lives in playbooks (manifest / selective embed via policy).
 * Prompt bodies stay goal/input-specific — do not restate entire SOPs here.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import { optionalProjectUuidField } from '../../../tools/lib/schema-fields.js';
import { bindProfilePromptContext } from '../../lib/prompt-context.js';

import {
  CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS,
  CONTENT_DEVELOPER_INVARIANTS,
} from './invariants.js';
import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_TOPIC_META,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { ContentDeveloperPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const PROJECT_UUID_HINT = '(pass on every tool, or use HTTP pin — else PROJECT_SCOPE_REQUIRED)';

const TOPIC_DASHBOARDS = 'dashboards' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_DASHBOARD_DESIGN = 'dashboard-design' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_CHART_TYPES = 'chart-types' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_TABLE_CALCULATIONS =
  'table-calculations' as const satisfies ContentDeveloperPlaybookTopic;
const DASHBOARD_CHART_TOPIC_IDS = [
  TOPIC_DASHBOARDS,
  TOPIC_DASHBOARD_DESIGN,
  TOPIC_CHART_TYPES,
] as const;
const DASHBOARD_TOPIC_IDS = [TOPIC_DASHBOARDS, TOPIC_DASHBOARD_DESIGN] as const;
const DASHBOARD_PUBLISH_TOPIC_IDS = [TOPIC_DASHBOARDS, TOPIC_CHART_TYPES] as const;

const WRITE_RECOVERY_TOPICS = [
  {
    topic: 'recovery/preview-stale' as const satisfies ContentDeveloperPlaybookTopic,
    when: 'After PREVIEW_STALE (hash mismatch or baseline drift)',
  },
  {
    topic: 'recovery/preview-required' as const satisfies ContentDeveloperPlaybookTopic,
    when: 'After PREVIEW_REQUIRED (missing, invalid, or expired token)',
  },
  {
    topic: 'recovery/dashboard-diff' as const satisfies ContentDeveloperPlaybookTopic,
    when: 'When interpreting dashboard preview diff.removed noise vs omissions',
  },
] as const;

/** Thin stop gate — Phase Design / Objective detail lives in dashboard-design playbook. */
const DESIGN_SPEC_STOP =
  'Emit a Design Spec (dashboard-design Phase Design: Objective + tiles with tableName citing insights + filter apply/exclude plan), then **stop until the user proceeds / approves / amends** before any preview_* or write. If the user already gave an explicit all-chart-types (or multi-viz) checklist + goal + projectUuid, a one-line Objective restatement is enough — treat that as approval after restating once. Always pass projectUuid on confirm_preview and apply when there is no HTTP pin.';

const bindPromptContext = bindProfilePromptContext({
  invariants: CONTENT_DEVELOPER_INVARIANTS,
  core: CONTENT_DEVELOPER_CORE_PLAYBOOK,
  topics: CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
  topicMeta: CONTENT_DEVELOPER_TOPIC_META,
});

export function registerContentDeveloperPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const promptContext = bindPromptContext(options?.promptContextPolicy);
  const invariantIds = CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS;

  server.registerPrompt(
    'create_dashboard',
    {
      title: 'Create dashboard',
      description:
        'Clarify Objective → Design Spec (await approval) → shell → dashboardSlug charts → tiles / filters',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuidField(),
        spaceUuid: z.string().optional(),
        chartReferences: z.string().optional(),
      },
    },
    ({ goal, projectUuid, spaceUuid, chartReferences }) =>
      promptContext({
        task: `Create a new dashboard for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

Target existing space: ${spaceUuid ?? '(resolve with lightdash_list_spaces / lightdash_get_space — never create a space)'}.
Chart hints: ${chartReferences ?? '(none provided — discover seeds via get_space / short search_content, then get_chart_as_code)'}.

1. If the goal is vague on audience / decisions / what to understand: ask **2–4 clarifying questions** before a Spec (do not invent a viz-type checklist).
2. Read-only discovery only (project/space/seeds).
3. ${DESIGN_SPEC_STOP} Multi-viz / all chart types only if the user explicitly asked (see dashboards + chart-types playbooks). For explicit all-types work, keep primary insights decision-oriented and place redundant required forms in a labeled validation appendix; never weaken semantic field requirements.
4. After approval: follow playbooks (preview→confirm→apply; reuse the **exact** preview payload on apply — do not tidy description/name between confirm and create).
5. Report dashboard UUID/slug, tiles, filters, chart UUIDs — reject space-only orphans or untiled dashboard-owned charts.`,
        invariantIds,
        requiredTopics: DASHBOARD_CHART_TOPIC_IDS,
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );

  server.registerPrompt(
    'improve_dashboard',
    {
      title: 'Improve dashboard',
      description:
        'Clarify Objective if needed → Design Spec delta (await approval) → layout / filters / tiles',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        improvementGoal: z.string(),
        projectUuid: optionalProjectUuidField(),
      },
    },
    ({ dashboardUuidOrSlug, improvementGoal, projectUuid }) =>
      promptContext({
        task: `Improve dashboard ${dashboardUuidOrSlug} for this goal:

${improvementGoal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

1. Inspect with lightdash_get_dashboard first (tile x/y/w/h may be missing — rebuild layout intentionally).
2. If the improvement goal is vague on decisions / insights: ask **2–4 clarifying questions** before a Spec delta.
3. For material layout/tile/filter changes (including professionalize): ${DESIGN_SPEC_STOP} Use the **Improve / professionalize Spec delta** (keep / drop / rename + cull) in dashboard-design. Trivial one-shot renames the user already specified may skip the stop. Multi-viz / all chart types only if the user explicitly asked.
4. After approval: follow playbooks (reuse the **exact** preview payload on apply). New charts: get_chart_as_code + dashboardSlug, then tile. Rename tile titles and chart names when stripping demo prefixes.
Report what changed (tiles, filters, chart UUIDs), any untiled dashboard-owned leftovers (content-governance for soft-delete), and validation warnings.`,
        invariantIds,
        requiredTopics: DASHBOARD_CHART_TOPIC_IDS,
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );

  server.registerPrompt(
    'refactor_dashboard',
    {
      title: 'Refactor dashboard',
      description:
        'Compare versions; Design Spec delta for material changes (await approval), then reconcile',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        concern: z.string().optional(),
        projectUuid: optionalProjectUuidField(),
      },
    },
    ({ dashboardUuidOrSlug, concern, projectUuid }) =>
      promptContext({
        task: `Refactor dashboard ${dashboardUuidOrSlug}.

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

Concern: ${concern ?? '(general cleanup)'}.
1. Use lightdash_compare_dashboard_versions before proposing changes.
2. For material layout/tile/filter changes: ${DESIGN_SPEC_STOP} Trivial one-shot renames may skip the stop.
3. After approval: follow dashboards + dashboard-design. Do not remove tiles unless the approved Spec or user request allows it.`,
        invariantIds,
        requiredTopics: DASHBOARD_TOPIC_IDS,
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );

  server.registerPrompt(
    'author_chart',
    {
      title: 'Author chart',
      description:
        'Clone a working seed chart (cartesian encode intact); optional dashboardSlug scoping',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuidField(),
        seedChartUuidOrSlug: z.string().optional(),
        dashboardSlug: z.string().optional(),
      },
    },
    ({ goal, projectUuid, seedChartUuidOrSlug, dashboardSlug }) =>
      promptContext({
        task: `Author a semantic chart for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.
Seed chart: ${seedChartUuidOrSlug ?? '(find a rendering seed on the same tableName via search_content / get_space)'}.
Dashboard slug: ${dashboardSlug ?? '(omit only for intentional space-owned charts; for dashboard work set dashboardSlug to an existing dashboard shell)'}.

Follow core + chart-types + table-calculations (clone via get_chart_as_code; preview with top-level slug; keep customDimensions when needed; tile if dashboardSlug set).
When dashboardSlug is set, the chart must serve a **board insight** from the approved Design Spec — do not invent a viz type for its own sake.
Report UUID/slug from charts[0].data; note this profile cannot run_chart / prove UI render.`,
        invariantIds,
        requiredTopics: [TOPIC_CHART_TYPES, TOPIC_TABLE_CALCULATIONS],
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );

  server.registerPrompt(
    'move_content',
    {
      title: 'Move content',
      description: 'Move charts/dashboards into an existing space (no space create/update)',
      argsSchema: {
        goal: z.string(),
        projectUuid: optionalProjectUuidField(),
        spaceReferences: z.string().optional(),
      },
    },
    ({ goal, projectUuid, spaceReferences }) =>
      promptContext({
        task: `Move content between existing spaces for this goal:

${goal}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

Space hints: ${spaceReferences ?? '(discover with lightdash_list_spaces)'}.
Follow core + content-move playbooks. Target spaces must already exist.
Report moved items and target space.`,
        invariantIds,
        requiredTopics: ['content-move'],
      }),
  );

  server.registerPrompt(
    'publish_content',
    {
      title: 'Publish content',
      description: 'Validate dashboard-scoped authored content before treating it as done',
      argsSchema: {
        contentReferences: z.string(),
        projectUuid: optionalProjectUuidField(),
      },
    },
    ({ contentReferences, projectUuid }) =>
      promptContext({
        task: `Finalize this authored Lightdash content before considering it done:

${contentReferences}

Project UUID: ${projectUuid ?? PROJECT_UUID_HINT}.

Done checklist: markdown/description states the **Objective**; tiles map to approved insight questions; every saved filter matches each tile explore or has explicit tileTargets exclude/remap; dashboardSlug on new charts + tiles present; cartesian encode intact; no invented fieldIds. Report untiled dashboard-owned leftovers (soft-delete via content-governance). Follow playbooks for encode/map/filter detail. UI runtime not verified on this profile.
Optionally validate_* (schema/health only). Promote is content-governance, not this profile.`,
        invariantIds,
        requiredTopics: DASHBOARD_PUBLISH_TOPIC_IDS,
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
