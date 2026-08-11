/**
 * Content-governance structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const CONTENT_GOVERNANCE_INVARIANTS = [
  {
    id: 'no-permanent-purge',
    short: 'Do not permanently purge soft-deleted content.',
  },
  {
    id: 'no-space-or-bulk-delete',
    short: 'Do not delete spaces or perform bulk delete.',
  },
  {
    id: 'elicitation-required',
    short:
      'Do not soft-delete or promote without form elicitation (never invent confirmed: true or chat-only approval).',
  },
  {
    id: 'no-bypass-elicitation',
    short: 'Do not expose deletes/promote on other profiles or bypass the elicitation gate.',
  },
  {
    id: 'dashboard-first-promote',
    short: 'Do not promote charts or SQL charts via MCP (dashboard-first only).',
  },
  {
    id: 'no-restore-or-query',
    short: 'Do not restore, author, or execute warehouse queries from this profile.',
  },
  {
    id: 'no-secrets',
    short: 'Do not reveal secrets, warehouse credentials, or hidden SQL.',
  },
] as const satisfies readonly PromptInvariant[];

export const CONTENT_GOVERNANCE_HARD_BANS = formatHardBansProjection(CONTENT_GOVERNANCE_INVARIANTS);

export const CONTENT_GOVERNANCE_DEFAULT_INVARIANT_IDS = allInvariantIds(
  CONTENT_GOVERNANCE_INVARIANTS,
);
