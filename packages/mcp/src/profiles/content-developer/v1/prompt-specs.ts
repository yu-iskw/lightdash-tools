/**
 * Pure PromptContextSpec builders for content-developer prompts.
 * Shared by registerContentDeveloperPrompts and budget gates.
 */

import { PROMPT_PROJECT_UUID_HINT } from '../../../tools/lib/schema-fields.js';

import { CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS } from './invariants.js';

import type { ContentDeveloperPlaybookTopic } from './resources/playbooks.js';
import type { PromptContextSpec } from '../../lib/prompt-context.js';

const TOPIC_DASHBOARDS = 'dashboards' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_DASHBOARD_DESIGN = 'dashboard-design' as const satisfies ContentDeveloperPlaybookTopic;
const TOPIC_CHART_TYPES = 'chart-types' as const satisfies ContentDeveloperPlaybookTopic;

/** Topics for create/improve dashboard prompts (shell + design + viz). */
export const DASHBOARD_CHART_TOPIC_IDS = [
  TOPIC_DASHBOARDS,
  TOPIC_DASHBOARD_DESIGN,
  TOPIC_CHART_TYPES,
] as const;

/** Manifest `when` comes from TOPIC_META.useWhen (optional `when` on entries). */
export const WRITE_RECOVERY_TOPICS = [
  { topic: 'recovery/preview-stale' as const satisfies ContentDeveloperPlaybookTopic },
  { topic: 'recovery/preview-required' as const satisfies ContentDeveloperPlaybookTopic },
  { topic: 'recovery/dashboard-diff' as const satisfies ContentDeveloperPlaybookTopic },
] as const;

/** Thin stop gate — Phase Design / Objective detail lives in dashboard-design playbook. */
export const DESIGN_SPEC_STOP =
  'Emit a Design Spec (dashboard-design Phase Design: Objective + tiles with tableName citing insights + filter apply/exclude plan), then **stop until the user proceeds / approves / amends** before any preview_* or write. If the user already gave an explicit all-chart-types (or multi-viz) checklist + goal + projectUuid, a one-line Objective restatement is enough — treat that as approval after restating once. Always pass projectUuid on confirm_preview and apply when there is no HTTP pin.';

export type CreateDashboardPromptArgs = {
  goal: string;
  projectUuid?: string;
  spaceUuid?: string;
  chartReferences?: string;
};

/**
 * Production PromptContextSpec for `create_dashboard` (task + topics + recovery).
 */
export function buildCreateDashboardPromptSpec(
  args: CreateDashboardPromptArgs,
): PromptContextSpec<ContentDeveloperPlaybookTopic> {
  const { goal, projectUuid, spaceUuid, chartReferences } = args;
  return {
    task: `Create a new dashboard for this goal:

${goal}

Project UUID: ${projectUuid ?? PROMPT_PROJECT_UUID_HINT}.

Target existing space: ${spaceUuid ?? '(resolve with lightdash_list_spaces / lightdash_get_space — never create a space)'}.
Chart hints: ${chartReferences ?? '(none provided — discover seeds via get_space / short search_content, then get_chart_as_code)'}.

1. If the goal is vague on audience / decisions / what to understand: ask **2–4 clarifying questions** before a Spec (do not invent a viz-type checklist).
2. Read-only discovery only (project/space/seeds).
3. ${DESIGN_SPEC_STOP} Multi-viz / all chart types only if the user explicitly asked (see dashboards + chart-types playbooks). For explicit all-types work, keep primary insights decision-oriented and place redundant required forms in a labeled validation appendix; never weaken semantic field requirements.
4. After approval: follow playbooks (preview→confirm→apply; reuse the **exact** preview payload on apply — do not tidy description/name between confirm and create).
5. Report dashboard UUID/slug, tiles, filters, chart UUIDs — reject space-only orphans or untiled dashboard-owned charts.`,
    invariantIds: CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS,
    requiredTopics: DASHBOARD_CHART_TOPIC_IDS,
    recoveryTopics: WRITE_RECOVERY_TOPICS,
  };
}
