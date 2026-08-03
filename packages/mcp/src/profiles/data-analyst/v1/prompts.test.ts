/**
 * Data-analyst prompt/playbook invariants.
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { DATA_ANALYST_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('data-analyst prompts/playbook', () => {
  it('playbook references registered tools and hard bans', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of listMcpToolNamesByProfile('data-analyst')) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md.toLowerCase()).toContain('hard bans');
    expect(DATA_ANALYST_HARD_BANS.toLowerCase()).toContain('raw sql');
    expect(DATA_ANALYST_HARD_BANS.toLowerCase()).toContain('mutate');
    expect(md.toLowerCase()).toContain('tablecalculations');
  });

  it('explore playbook requires fieldIds and forbids saving charts by default', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('run_metric_query');
    expect(md).toContain('fieldid');
    expect(md).toContain('without saving');
  });
});
