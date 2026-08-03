/**
 * AI agent-ops prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { AI_AGENT_OPS_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

import { AI_AGENT_OPS_TOOL_IDS } from './index.js';

describe('ai-agent-ops prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of AI_AGENT_OPS_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(AI_AGENT_OPS_HARD_BANS.toLowerCase()).toContain('recommend');
  });

  it('playbook forbids offline mega-tools and agent CRUD on MCP', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('no offline scorers');
    expect(md).toContain('agentops');
    expect(md).toContain('evaluate_agent_readiness');
    expect(md).toContain('run_agent_evaluation');
  });
});
