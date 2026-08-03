/**
 * Semantic-layer prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { SEMANTIC_LAYER_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

import { SEMANTIC_LAYER_TOOL_IDS } from './index.js';

describe('semantic-layer prompts/playbook', () => {
  it('playbooks reference only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of SEMANTIC_LAYER_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(SEMANTIC_LAYER_HARD_BANS.toLowerCase()).toContain('sql');
  });
});
