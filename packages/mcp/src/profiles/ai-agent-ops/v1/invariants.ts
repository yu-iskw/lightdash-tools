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
    short: 'Do not create/update/delete agents on this server.',
  },
  {
    id: 'no-thread-mutation',
    short: 'Do not start or continue threads.',
  },
  {
    id: 'no-resource-mutation',
    short: 'Do not mutate users/roles/semantic models/charts.',
  },
  {
    id: 'no-offline-scorers',
    short: 'Do not run local offline scorers.',
  },
  {
    id: 'no-git-eval-stores',
    short: 'Do not write Git eval artifact stores via MCP.',
  },
  {
    id: 'no-invent-mega-tools',
    short:
      'Do not invent recommend_* or analyze_* mega-tools. Those capabilities are not available as MCP mega-tools here — use CLI agentops / other profiles / the host.',
  },
  {
    id: 'no-mcp-only-gate-claim',
    short: 'Do not claim a CLI promotion gate passed from MCP run results alone.',
  },
] as const satisfies readonly PromptInvariant[];

export const AI_AGENT_OPS_HARD_BANS = formatHardBansProjection(AI_AGENT_OPS_INVARIANTS);

export const AI_AGENT_OPS_DEFAULT_INVARIANT_IDS = allInvariantIds(AI_AGENT_OPS_INVARIANTS);
