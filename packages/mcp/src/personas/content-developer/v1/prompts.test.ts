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
    expect(md).toContain('charts[0].data.uuid');
    expect(md).toMatch(/≤2 concurrent|<=2 concurrent/);
  });

  it('documents dashboard-design topic with markdown and filters', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('dashboard-design');
    expect(md).toContain('markdown');
    expect(md).toContain('empty-value');
    expect(md).toContain('filters');
    expect(md).toMatch(/required:\s*true|required:true/);
    expect(md).toContain('phase design');
    expect(md).toContain('before any write');
    expect(md).toContain('design spec');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('design spec');
  });

  it('requires objective-first Design Spec and clarify-before-spec language', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('objective');
    expect(md).toMatch(/insight question/);
    expect(md).toMatch(/clarif/);
    expect(md).toMatch(/cites an insight|cite an insight|citing insights/);
    expect(md).toMatch(/only when the user \*\*explicitly\*\* asks|only when the user explicitly/);
    expect(md).toMatch(/reference map|not a build order/);
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('objective');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toMatch(
      /viz-type|all-chart-types|all chart types/,
    );
  });

  it('documents explore↔filter Spec with tileTargets exclude', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('tiletargets');
    expect(md).toMatch(/exclude/);
    expect(md).toMatch(/one explore|same-explore/);
    expect(md).toMatch(/tile uuid|tile uuids/);
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('tiletargets');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toMatch(/target\.tablename|tablename/);
  });

  it('documents improve/professionalize Spec delta, cull, and leftover handoff', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/professionalize|improve \/ professionalize/);
    expect(md).toMatch(/keep \/ drop \/ rename|keep\/drop\/rename/);
    expect(md).toMatch(/cull/);
    expect(md).toMatch(/untiled|leftover/);
    expect(md).toContain('content-governance');
  });

  it('does not register standalone build_chart or design_dashboard prompt', async () => {
    const { registerContentDeveloperPrompts } = await import('./prompts.js');
    const names: string[] = [];
    const promptArgs: Array<{ name: string; messages: unknown }> = [];
    let publishText = '';
    let authorText = '';
    let refactorText = '';
    const server = {
      registerPrompt: (
        name: string,
        _meta: unknown,
        handler: (args: Record<string, unknown>) => { messages: unknown },
      ) => {
        names.push(name);
        if (
          name === 'create_dashboard' ||
          name === 'improve_dashboard' ||
          name === 'refactor_dashboard'
        ) {
          promptArgs.push({
            name,
            messages: handler({
              goal: 'x',
              improvementGoal: 'y',
              dashboardUuidOrSlug: 'dash-1',
            }).messages,
          });
        }
        if (name === 'publish_content') {
          const messages = handler({ contentReferences: 'dash-1' }).messages as Array<{
            content: { type: string; text?: string };
          }>;
          publishText = messages
            .filter((m) => m.content.type === 'text')
            .map((m) => m.content.text ?? '')
            .join('\n')
            .toLowerCase();
        }
        if (name === 'author_chart') {
          const messages = handler({
            goal: 'kpi',
            dashboardSlug: 'my-dash',
          }).messages as Array<{
            content: { type: string; text?: string };
          }>;
          authorText = messages
            .filter((m) => m.content.type === 'text')
            .map((m) => m.content.text ?? '')
            .join('\n')
            .toLowerCase();
        }
        if (name === 'refactor_dashboard') {
          const messages = handler({
            dashboardUuidOrSlug: 'dash-1',
          }).messages as Array<{
            content: { type: string; text?: string };
          }>;
          refactorText = messages
            .filter((m) => m.content.type === 'text')
            .map((m) => m.content.text ?? '')
            .join('\n')
            .toLowerCase();
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
    expect(names).toContain('refactor_dashboard');
    expect(names).toContain('publish_content');

    for (const { name, messages } of promptArgs) {
      const typed = messages as Array<{
        content: { type: string; text?: string; resource?: { uri?: string } };
      }>;
      const text = typed
        .filter((m) => m.content.type === 'text')
        .map((m) => m.content.text ?? '')
        .join('\n')
        .toLowerCase();
      expect(text).toContain('design spec');
      expect(text).toMatch(/stop until the user proceeds|proceeds \/ approves/);

      const uris = typed
        .filter((m) => m.content.type === 'resource')
        .map((m) => m.content.resource?.uri);
      expect(uris).toContain('lightdash://playbooks/content-developer/core');
      expect(uris).toContain('lightdash://playbooks/content-developer/dashboards');
      expect(uris).toContain('lightdash://playbooks/content-developer/dashboard-design');
      if (name === 'create_dashboard' || name === 'improve_dashboard') {
        expect(text).toContain('objective');
        expect(text).toMatch(/clarif/);
        expect(text).toMatch(/only if the user explicitly asked/);
        expect(text).toMatch(/tablename|filter apply\/exclude|apply\/exclude/);
        expect(uris).toContain('lightdash://playbooks/content-developer/chart-types');
      }
      if (name === 'improve_dashboard') {
        expect(text).toMatch(/keep \/ drop \/ rename|professionalize/);
        expect(text).toMatch(/untiled|leftover/);
        expect(text).toContain('content-governance');
      }
    }

    expect(publishText).toContain('objective');
    expect(publishText).toMatch(/insight/);
    expect(publishText).toMatch(/tiletargets|exclude\/remap|exclude\/remap/);
    expect(publishText).toMatch(/untiled|leftover/);
    expect(publishText).toContain('content-governance');
    expect(authorText).toContain('board insight');
    expect(refactorText).toMatch(/approved spec|user request allows/);
    expect(refactorText).not.toMatch(/unless explicitly requested/);
  });
});
