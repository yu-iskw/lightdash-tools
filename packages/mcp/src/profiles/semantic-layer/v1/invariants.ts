/**
 * Semantic-layer structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const SEMANTIC_LAYER_INVARIANTS = [
  {
    id: 'no-query-execution',
    short: 'Do not run metric/SQL/chart queries or use SQL runner.',
  },
  {
    id: 'no-validation-jobs',
    short: 'Do not trigger validation jobs.',
  },
  {
    id: 'no-mutation',
    short: 'Do not mutate content.',
  },
  {
    id: 'project-scope',
    short: 'Do not switch away from the given projectUuid.',
  },
  {
    id: 'no-invent-field-ids',
    short: 'Do not invent fieldIds.',
  },
  {
    id: 'no-dump-payloads',
    short: 'Do not dump full explore/metric/lineage payloads.',
  },
  {
    id: 'no-ai-identity',
    short: 'Do not call AI/identity tools. Those are not available on this server.',
  },
] as const satisfies readonly PromptInvariant[];

export const SEMANTIC_LAYER_HARD_BANS = formatHardBansProjection(SEMANTIC_LAYER_INVARIANTS);

export const SEMANTIC_LAYER_DEFAULT_INVARIANT_IDS = allInvariantIds(SEMANTIC_LAYER_INVARIANTS);
