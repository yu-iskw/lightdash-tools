/**
 * Content-reader prompt/playbook invariants.
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { CONTENT_READER_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('content-reader prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of listMcpToolNamesByProfile('content-reader')) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(CONTENT_READER_HARD_BANS.toLowerCase()).toContain('sql');
  });

  it('playbook forbids mutation and arbitrary queries', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('do not mutate');
    expect(md).toContain('underlying-data');
    expect(md).toContain('sql charts');
  });
});
