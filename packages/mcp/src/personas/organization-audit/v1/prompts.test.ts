/**
 * Organization-audit prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { getPlaybookMarkdown, ORGANIZATION_AUDIT_HARD_BANS } from './resources/playbook.js';

import { ORGANIZATION_AUDIT_TOOL_IDS } from './index.js';

describe('organization-audit prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getPlaybookMarkdown();
    for (const id of ORGANIZATION_AUDIT_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(ORGANIZATION_AUDIT_HARD_BANS.toLowerCase()).toContain('compliance');
  });

  it('playbook forbids mutation and warehouse queries', () => {
    const md = getPlaybookMarkdown().toLowerCase();
    expect(md).toContain('do not mutate');
    expect(md).toContain('warehouse');
    expect(md).toContain('deletion');
  });
});
