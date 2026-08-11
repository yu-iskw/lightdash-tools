/**
 * AI agent-ops structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const AI_AGENT_OPS_INVARIANTS = [
  {
    id: 'no-agent-crud',
    severity: 'critical',
    short: 'Do not create/update/delete agents on this server.',
  },
  {
    id: 'no-thread-mutation',
    severity: 'critical',
    short: 'Do not start or continue threads.',
  },
  {
    id: 'no-resource-mutation',
    severity: 'critical',
    short: 'Do not mutate users/roles/semantic models/charts.',
  },
  {
    id: 'no-offline-scorers',
    severity: 'critical',
    short: 'Do not run local offline scorers.',
  },
  {
    id: 'no-git-eval-stores',
    severity: 'critical',
    short: 'Do not write Git eval artifact stores via MCP.',
  },
  {
    id: 'no-invent-mega-tools',
    severity: 'critical',
    short:
      'Do not invent recommend_* or analyze_* mega-tools. Those capabilities are not available as MCP mega-tools here — use CLI agentops / other profiles / the host.',
  },
  {
    id: 'no-mcp-only-gate-claim',
    severity: 'critical',
    short: 'Do not claim a CLI promotion gate passed from MCP run results alone.',
  },
] as const satisfies readonly PromptInvariant[];

export const AI_AGENT_OPS_HARD_BANS = formatHardBansProjection(AI_AGENT_OPS_INVARIANTS);

export const AI_AGENT_OPS_DEFAULT_INVARIANT_IDS = allInvariantIds(AI_AGENT_OPS_INVARIANTS);
