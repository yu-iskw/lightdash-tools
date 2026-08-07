/**
 * Content-reader prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { CONTENT_READER_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('content-reader prompts/playbook', () => {
  it('playbook references only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    expectPlaybookCoversProfileTools('content-reader', md);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(CONTENT_READER_HARD_BANS.toLowerCase()).toContain('sql');
  });

  it('playbook forbids mutation and arbitrary queries', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('do not mutate');
    expect(md).toContain('underlying-data');
    expect(md).toContain('sql charts');
  });

  it('prefers list_verified_content when verifiedOnly is set', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('list_verified_content');
    expect(md).toMatch(/list_verified_content.*before.*search_content|verified first/);
    expect(md).toContain('does **not** filter by verification');
  });
});
