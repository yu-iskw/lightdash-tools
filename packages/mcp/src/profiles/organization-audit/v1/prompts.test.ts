/**
 * Organization-audit prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { getAllPlaybookMarkdown, ORGANIZATION_AUDIT_HARD_BANS } from './resources/playbooks.js';

describe('organization-audit prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    expectPlaybookCoversProfileTools('organization-audit', md);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(ORGANIZATION_AUDIT_HARD_BANS.toLowerCase()).toContain('compliance');
  });

  it('playbook forbids mutation and warehouse queries', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('do not mutate');
    expect(md).toContain('warehouse');
    expect(md).toContain('deletion');
  });
});
