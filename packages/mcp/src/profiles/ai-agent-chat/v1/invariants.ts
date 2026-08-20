/**
 * AI-agent-chat structured prompt invariants (SSOT for capsules + HARD_BANS projection).
 */

import {
  allInvariantIds,
  formatHardBansProjection,
  type PromptInvariant,
} from '../../lib/prompt-invariants.js';

export const AI_AGENT_CHAT_INVARIANTS = [
  {
    id: 'no-agent-admin',
    short: 'Do not create, update, delete, or reconfigure AI Agents.',
  },
  {
    id: 'no-agent-evaluations',
    short: 'Do not create, change, delete, or run AI-agent evaluations.',
  },
  {
    id: 'own-thread-scope',
    short:
      'Use only threads the current Lightdash identity is authorized to access. Do not seek cross-user conversation access.',
  },
  {
    id: 'no-sql-mode',
    short: 'Do not attempt to enable SQL mode or approve SQL.',
  },
  {
    id: 'no-agent-mcp-config',
    short:
      'Do not add, remove, authenticate, or reconfigure MCP servers/tools attached to an agent.',
  },
  {
    id: 'no-host-reimplementation',
    short:
      'Do not replace the requested managed Lightdash AI Agent with data-analyst/semantic-layer tools unless the user explicitly asks for that alternative.',
  },
  {
    id: 'conversation-is-open-world',
    short:
      'Generation may invoke model, warehouse, and configured agent tools; do not describe it as read-only.',
  },
  {
    id: 'respect-project-scope',
    short: 'Resolve and enforce the existing project pin/allowlist contract.',
  },
] as const satisfies readonly PromptInvariant[];

export const AI_AGENT_CHAT_HARD_BANS = formatHardBansProjection(AI_AGENT_CHAT_INVARIANTS);

export const AI_AGENT_CHAT_DEFAULT_INVARIANT_IDS = allInvariantIds(AI_AGENT_CHAT_INVARIANTS);
