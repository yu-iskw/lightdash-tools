/**
 * Content-governance prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { CONTENT_GOVERNANCE_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

import { CONTENT_GOVERNANCE_TOOL_IDS } from './index.js';

describe('content-governance prompts/playbook', () => {
  it('playbooks reference only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of CONTENT_GOVERNANCE_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(CONTENT_GOVERNANCE_HARD_BANS.toLowerCase()).toContain('permanently purge');
  });

  it('documents elicitation SOP, soft-delete, and promote bans', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('elicitation_required');
    expect(md).toContain('resource_changed');
    expect(md).toContain('confirm_delete');
    expect(md).toContain('confirm_promote');
    expect(md).toContain('confirmationtext');
    expect(md).toContain('soft-delete');
    expect(md).toContain('promote_dashboard');
    expect(md).toContain('permanently purge');
    expect(md).not.toMatch(/`permanent_delete/);
  });

  it('registers delete and promote prompts', async () => {
    const { registerContentGovernancePrompts } = await import('./prompts.js');
    const names: string[] = [];
    const server = {
      registerPrompt: (name: string) => {
        names.push(name);
      },
    };
    registerContentGovernancePrompts(server as never);
    expect(names.sort()).toEqual(['delete_chart', 'delete_dashboard', 'promote_dashboard']);
  });
});
