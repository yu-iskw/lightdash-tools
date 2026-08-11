/**
 * Data-analyst structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import { formatHardBansProjection, type PromptInvariant } from '../../lib/prompt-invariants.js';

export const DATA_ANALYST_INVARIANTS = [
  {
    id: 'no-mutation',
    severity: 'critical',
    short: 'Do not mutate Lightdash resources (create/update/delete/move charts or dashboards).',
  },
  {
    id: 'no-raw-sql-or-drills',
    severity: 'critical',
    short: 'Do not run raw SQL, tableCalculations, underlying-data drills, or result downloads.',
  },
  {
    id: 'no-saved-chart-execution',
    severity: 'critical',
    short: 'Do not execute saved charts (use content-reader) or invent fieldIds.',
  },
  {
    id: 'no-overstate-coverage',
    severity: 'critical',
    short: 'Do not present truncated results as complete.',
  },
  {
    id: 'project-scope',
    severity: 'critical',
    short: 'Do not run queries outside the resolved project (pass projectUuid or HTTP pin).',
  },
] as const satisfies readonly PromptInvariant[];

export const DATA_ANALYST_HARD_BANS = formatHardBansProjection(DATA_ANALYST_INVARIANTS);

export const DATA_ANALYST_DEFAULT_INVARIANT_IDS = DATA_ANALYST_INVARIANTS.map(
  (inv) => inv.id,
) as unknown as readonly (typeof DATA_ANALYST_INVARIANTS)[number]['id'][];
