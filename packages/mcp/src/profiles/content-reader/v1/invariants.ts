/**
 * Content-reader structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import { formatHardBansProjection, type PromptInvariant } from '../../lib/prompt-invariants.js';

export const CONTENT_READER_INVARIANTS = [
  {
    id: 'no-mutation',
    severity: 'critical',
    short: 'Do not mutate Lightdash resources.',
  },
  {
    id: 'no-arbitrary-query',
    severity: 'critical',
    short: 'Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.',
  },
  {
    id: 'no-bulk-export',
    severity: 'critical',
    short: 'Do not download or bulk-export results.',
  },
  {
    id: 'no-sql-chart-execution',
    severity: 'critical',
    short: 'Do not execute saved SQL charts (disabled by default on content-reader).',
  },
  {
    id: 'no-override-semantics',
    severity: 'critical',
    short:
      'Do not override filter targets, operators, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts.',
  },
  {
    id: 'project-scope',
    severity: 'critical',
    short: 'Do not execute content outside the resolved project (pass projectUuid or HTTP pin).',
  },
  {
    id: 'no-overstate-coverage',
    severity: 'critical',
    short: 'Do not present truncated results as complete.',
  },
  {
    id: 'no-label-equivalence',
    severity: 'critical',
    short: 'Do not claim metric equivalence from matching labels alone.',
  },
  {
    id: 'no-secrets',
    severity: 'critical',
    short: 'Do not reveal secrets, warehouse credentials, hidden SQL, or inaccessible content.',
  },
] as const satisfies readonly PromptInvariant[];

export const CONTENT_READER_HARD_BANS = formatHardBansProjection(CONTENT_READER_INVARIANTS);

export const CONTENT_READER_DEFAULT_INVARIANT_IDS = CONTENT_READER_INVARIANTS.map(
  (inv) => inv.id,
) as unknown as readonly (typeof CONTENT_READER_INVARIANTS)[number]['id'][];
