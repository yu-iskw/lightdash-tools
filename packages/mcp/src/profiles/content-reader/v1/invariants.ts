/**
 * Content-reader structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const CONTENT_READER_INVARIANTS = [
  {
    id: 'no-mutation',
    short: 'Do not mutate Lightdash resources.',
  },
  {
    id: 'no-arbitrary-query',
    short: 'Do not execute arbitrary metric queries, raw SQL, or underlying-data queries.',
  },
  {
    id: 'no-bulk-export',
    short: 'Do not download or bulk-export results.',
  },
  {
    id: 'no-sql-chart-execution',
    short:
      'Do not execute ad-hoc SQL or standalone SQL charts; saved dashboard SQL tiles are allowed.',
  },
  {
    id: 'no-override-semantics',
    short:
      'Do not override filter targets, operators, required-filter behavior, fields, metrics, dimensions, SQL, table calculations, or sorts.',
  },
  {
    id: 'project-scope',
    short: 'Do not execute content outside the resolved project (pass projectUuid or HTTP pin).',
  },
  {
    id: 'no-overstate-coverage',
    short: 'Do not present truncated results as complete.',
  },
  {
    id: 'no-label-equivalence',
    short: 'Do not claim metric equivalence from matching labels alone.',
  },
  {
    id: 'no-secrets',
    short:
      'Do not invent secrets, warehouse credentials, or SQL text; reveal authored SQL only via includeArtifacts.',
  },
] as const satisfies readonly PromptInvariant[];

export const CONTENT_READER_HARD_BANS = formatHardBansProjection(CONTENT_READER_INVARIANTS);

export const CONTENT_READER_DEFAULT_INVARIANT_IDS = allInvariantIds(CONTENT_READER_INVARIANTS);
