/**
 * MCP prompts for content-developer workflows (progressive-disclosure context).
 *
 * Procedure detail lives in playbooks (manifest / selective embed via policy).
 * Prompt bodies stay goal/input-specific — do not restate entire SOPs here.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import {
  formatPromptProjectUuidLine,
  optionalProjectUuidField,
} from '../../../tools/lib/schema-fields.js';
import { bindProfilePromptContext } from '../../lib/prompt-context.js';

import {
  CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS,
  CONTENT_DEVELOPER_INVARIANTS,
} from './invariants.js';
import {
  buildCreateDashboardPromptSpec,
  DASHBOARD_CHART_TOPIC_IDS,
  DASHBOARD_PUBLISH_TOPIC_IDS,
  DASHBOARD_TOPIC_IDS,
  DESIGN_SPEC_STOP,
  WRITE_RECOVERY_TOPICS,
} from './prompt-specs.js';
import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_TOPIC_META,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { ContentDeveloperPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TOPIC_CHART_TYPES = 'chart-types' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_TABLE_CALCULATIONS =
  'table-calculations' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_CONTENT_MOVE = 'content-move' as const satisfies ContentDeveloperPlaybookTopic;

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
      promptContext(
        buildCreateDashboardPromptSpec({ goal, projectUuid, spaceUuid, chartReferences }),
      ),
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

${formatPromptProjectUuidLine(projectUuid)}

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

${formatPromptProjectUuidLine(projectUuid)}

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

${formatPromptProjectUuidLine(projectUuid)}
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

${formatPromptProjectUuidLine(projectUuid)}

Space hints: ${spaceReferences ?? '(discover with lightdash_list_spaces)'}.
Follow core + content-move playbooks. Target spaces must already exist.
Report moved items and target space.`,
        invariantIds,
        requiredTopics: [TOPIC_CONTENT_MOVE],
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

${formatPromptProjectUuidLine(projectUuid)}

Done checklist: markdown/description states the **Objective**; tiles map to approved insight questions; every saved filter matches each tile explore or has explicit tileTargets exclude/remap; dashboardSlug on new charts + tiles present; cartesian encode intact; no invented fieldIds. Report untiled dashboard-owned leftovers (soft-delete via content-governance). Follow playbooks for encode/map/filter detail. UI runtime not verified on this profile.
Optionally validate_* (schema/health only). Promote is content-governance, not this profile.`,
        invariantIds,
        requiredTopics: DASHBOARD_PUBLISH_TOPIC_IDS,
        recoveryTopics: WRITE_RECOVERY_TOPICS,
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
