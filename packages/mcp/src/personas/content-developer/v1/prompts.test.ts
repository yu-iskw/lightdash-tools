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
    expect(md).toContain('dashboardslug');
    expect(md).toContain('get_chart_as_code');
    expect(md).toMatch(/dashboard shell first|create the dashboard shell first/);
    expect(md).toContain('encode');
    expect(md).toMatch(/xref/);
    expect(md).toContain('chart-types');
    expect(md).not.toMatch(/`create_space`/);
    expect(md).not.toMatch(/`update_space`/);
    expect(CONTENT_DEVELOPER_TOOL_IDS).not.toContain('create_space');
    expect(CONTENT_DEVELOPER_TOOL_IDS).not.toContain('update_space');
    expect(CONTENT_DEVELOPER_TOOL_IDS).toContain('get_chart_as_code');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('dashboardslug');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('skinny');
  });

  it('documents create-chart top-level slug, nested dashboard apply, and chart-type map', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('top-level');
    expect(md).toMatch(/dashboard:\s*\{/);
    expect(md).toMatch(
      /does \*\*not\*\* add tiles|does not place the chart|ownership alone does not/,
    );
    expect(md).toContain('pie');
    expect(md).toContain('sankey');
    expect(md).toContain('gauge');
    expect(md).toContain('map');
  });

  it('documents dashboard-design topic with markdown and filters', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('dashboard-design');
    expect(md).toContain('markdown');
    expect(md).toContain('empty-value');
    expect(md).toContain('filters');
    expect(md).toMatch(/required:\s*true|required:true/);
  });

  it('does not register standalone build_chart or design_dashboard prompt', async () => {
    const { registerContentDeveloperPrompts } = await import('./prompts.js');
    const names: string[] = [];
    const promptArgs: Array<{ name: string; messages: unknown }> = [];
    const server = {
      registerPrompt: (
        name: string,
        _meta: unknown,
        handler: (args: Record<string, unknown>) => { messages: unknown },
      ) => {
        names.push(name);
        if (name === 'create_dashboard' || name === 'improve_dashboard') {
          promptArgs.push({
            name,
            messages: handler({ goal: 'x', improvementGoal: 'y' }).messages,
          });
        }
      },
    };
    registerContentDeveloperPrompts(server as never);
    expect(names).not.toContain('build_chart');
    expect(names).not.toContain('design_dashboard');
    expect(names).toContain('author_chart');
    expect(names).toContain('move_content');
    expect(names).toContain('create_dashboard');
    expect(names).toContain('improve_dashboard');
    expect(names).toContain('publish_content');

    for (const { messages } of promptArgs) {
      const uris = (messages as Array<{ content: { type: string; resource?: { uri?: string } } }>)
        .filter((m) => m.content.type === 'resource')
        .map((m) => m.content.resource?.uri);
      expect(uris).toContain('lightdash://playbooks/content-developer/core');
      expect(uris).toContain('lightdash://playbooks/content-developer/dashboards');
      expect(uris).toContain('lightdash://playbooks/content-developer/dashboard-design');
    }
  });
});
