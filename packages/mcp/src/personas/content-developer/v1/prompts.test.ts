/**
 * Content-developer prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { CONTENT_DEVELOPER_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

import { CONTENT_DEVELOPER_TOOL_IDS } from './index.js';

describe('content-developer prompts/playbook', () => {
  it('playbooks reference only registered tool short ids', () => {
    const md = getAllPlaybookMarkdown();
    for (const id of CONTENT_DEVELOPER_TOOL_IDS) {
      expect(md.includes(id) || md.includes(`lightdash_${id}`)).toBe(true);
    }
    expect(md).not.toMatch(/\bldt__/);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('terraform');
  });

  it('forbids space create/update and orphan chart publish', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('terraform');
    expect(md).toContain('dashboard is the');
    expect(md).not.toMatch(/`create_space`/);
    expect(md).not.toMatch(/`update_space`/);
    expect(CONTENT_DEVELOPER_TOOL_IDS).not.toContain('create_space');
    expect(CONTENT_DEVELOPER_TOOL_IDS).not.toContain('update_space');
  });

  it('does not register standalone build_chart prompt', async () => {
    const { registerContentDeveloperPrompts } = await import('./prompts.js');
    const names: string[] = [];
    const server = {
      registerPrompt: (name: string) => {
        names.push(name);
      },
    };
    registerContentDeveloperPrompts(server as never);
    expect(names).not.toContain('build_chart');
    expect(names).toContain('move_content');
    expect(names).toContain('create_dashboard');
    expect(names).toContain('publish_content');
  });
});
