/**
 * Content-reader prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { CONTENT_READER_HARD_BANS, getPlaybookMarkdown } from './resources/playbook.js';

import { CONTENT_READER_TOOL_IDS } from './index.js';

describe('content-reader prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getPlaybookMarkdown();
    for (const id of CONTENT_READER_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(CONTENT_READER_HARD_BANS.toLowerCase()).toContain('sql');
  });

  it('playbook forbids mutation and arbitrary queries', () => {
    const md = getPlaybookMarkdown().toLowerCase();
    expect(md).toContain('do not mutate');
    expect(md).toContain('underlying-data');
    expect(md).toContain('sql charts');
  });
});
