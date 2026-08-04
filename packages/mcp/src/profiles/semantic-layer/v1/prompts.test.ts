/**
 * Semantic-layer prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { SEMANTIC_LAYER_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('semantic-layer prompts/playbook', () => {
  it('playbooks reference only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    expectPlaybookCoversProfileTools('semantic-layer', md);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(SEMANTIC_LAYER_HARD_BANS.toLowerCase()).toContain('sql');
  });
});
