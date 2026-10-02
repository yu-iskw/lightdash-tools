/**
 * Data-analyst structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const DATA_ANALYST_INVARIANTS = [
  {
    id: 'no-mutation',
    short: 'Do not mutate Lightdash resources (create/update/delete/move charts or dashboards).',
  },
  {
    id: 'no-raw-sql-or-drills',
    short: 'Do not run raw SQL, tableCalculations, underlying-data drills, or result downloads.',
  },
  {
    id: 'no-saved-chart-execution',
    short: 'Do not execute saved charts (use content-reader) or invent fieldIds.',
  },
  {
    id: 'no-overstate-coverage',
    short: 'Do not present truncated results as complete.',
  },
  {
    id: 'project-scope',
    short: 'Do not run queries outside the resolved project (pass projectUuid or HTTP pin).',
  },
] as const satisfies readonly PromptInvariant[];

export const DATA_ANALYST_HARD_BANS = formatHardBansProjection(DATA_ANALYST_INVARIANTS);

export const DATA_ANALYST_DEFAULT_INVARIANT_IDS = allInvariantIds(DATA_ANALYST_INVARIANTS);
