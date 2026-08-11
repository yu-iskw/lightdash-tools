/**
 * Semantic-layer structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import { formatHardBansProjection, type PromptInvariant } from '../../lib/prompt-invariants.js';

export const SEMANTIC_LAYER_INVARIANTS = [
  {
    id: 'no-query-execution',
    severity: 'critical',
    short: 'Do not run metric/SQL/chart queries or use SQL runner.',
  },
  {
    id: 'no-validation-jobs',
    severity: 'critical',
    short: 'Do not trigger validation jobs.',
  },
  {
    id: 'no-mutation',
    severity: 'critical',
    short: 'Do not mutate content.',
  },
  {
    id: 'project-scope',
    severity: 'critical',
    short: 'Do not switch away from the given projectUuid.',
  },
  {
    id: 'no-invent-field-ids',
    severity: 'critical',
    short: 'Do not invent fieldIds.',
  },
  {
    id: 'no-dump-payloads',
    severity: 'critical',
    short: 'Do not dump full explore/metric/lineage payloads.',
  },
  {
    id: 'no-ai-identity',
    severity: 'critical',
    short: 'Do not call AI/identity tools. Those are not available on this server.',
  },
] as const satisfies readonly PromptInvariant[];

export const SEMANTIC_LAYER_HARD_BANS = formatHardBansProjection(SEMANTIC_LAYER_INVARIANTS);

export const SEMANTIC_LAYER_DEFAULT_INVARIANT_IDS = SEMANTIC_LAYER_INVARIANTS.map(
  (inv) => inv.id,
) as unknown as readonly (typeof SEMANTIC_LAYER_INVARIANTS)[number]['id'][];
