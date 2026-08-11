/**
 * Organization-audit structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const ORGANIZATION_AUDIT_INVARIANTS = [
  {
    id: 'no-mutation',
    short: 'Do not mutate users/groups/roles/content/schedulers.',
  },
  {
    id: 'no-warehouse-query',
    short: 'Do not execute warehouse or chart queries.',
  },
  {
    id: 'no-csv-download',
    short: 'Do not download user-activity CSV.',
  },
  {
    id: 'no-secrets',
    short: 'Do not reveal secrets.',
  },
  {
    id: 'no-unbounded-crawl',
    short: 'Do not crawl unbounded org inventories. Prefer core budgets (page/project caps).',
  },
  {
    id: 'no-compliance-claim',
    short:
      'Do not claim compliance certification. Those capabilities are not available on this server.',
  },
] as const satisfies readonly PromptInvariant[];

export const ORGANIZATION_AUDIT_HARD_BANS = formatHardBansProjection(ORGANIZATION_AUDIT_INVARIANTS);

export const ORGANIZATION_AUDIT_DEFAULT_INVARIANT_IDS = allInvariantIds(
  ORGANIZATION_AUDIT_INVARIANTS,
);
