/**
 * Content-developer prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { getProfile, listToolIds } from '../../index.js';
import { playbookTopicUri } from '../../lib/playbook-resources.js';

import { CONTENT_DEVELOPER_INVARIANTS } from './invariants.js';
import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_HARD_BANS,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
  getAllPlaybookMarkdown,
} from './resources/playbooks.js';

describe('content-developer prompts/playbook', () => {
  it('keeps structured invariants and core.md Hard bans in sync (count + key phrases)', () => {
    const core = CONTENT_DEVELOPER_CORE_PLAYBOOK.getMarkdown();
    const hardBansSection = core.split('## Hard bans')[1]?.split('\n## ')[0] ?? '';
    const coreBullets = hardBansSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- Do not'));
    expect(coreBullets).toHaveLength(CONTENT_DEVELOPER_INVARIANTS.length);
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('resourcekind');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('subagent-driven-development');
    expect(hardBansSection.toLowerCase()).toContain('subagent-driven-development');
    expect(hardBansSection.toLowerCase()).toContain('resourcekind');
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
    expect(md).toContain('table-calculations');
    expect(md).not.toMatch(/`create_space`/);
    expect(md).not.toMatch(/`update_space`/);
    const toolIds = listToolIds(getProfile('content-developer'));
    expect(toolIds).not.toContain('create_space');
    expect(toolIds).not.toContain('update_space');
    expect(toolIds).toContain('get_chart_as_code');
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

  it('requires projectUuid on confirm_preview and multi-viz batch SOP', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/confirm_preview.*projectuuid|projectuuid.*confirm_preview/);
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('confirm_preview');
    expect(CONTENT_DEVELOPER_HARD_BANS.toLowerCase()).toContain('projectuuid');
    expect(md).toMatch(/batch sop|shell → create all charts|one.*update_dashboard/);
    expect(md).toMatch(/diff\.removed|diff noise/);
    expect(md).toMatch(
      /tiles.*diff\.removed|diff\.removed.*tiles|omit.*tiles|do \*\*not\*\* apply/,
    );
    expect(md).toContain('chartuuidorslug');
    expect(md).toMatch(/profile: \s*content-developer|serving profile/);
  });

  it('documents lab/inline Batch SOP and bans SDD-only MCP click loops', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    const bans = CONTENT_DEVELOPER_HARD_BANS.toLowerCase();
    expect(md).toMatch(/lab \/ inline|lab\/inline|inline build/);
    expect(md).toMatch(/batch sop in the same session|same session/);
    expect(md).toMatch(/subagent-driven-development|writing-plans/);
    expect(bans).toMatch(/subagent-driven-development|writing-plans/);
    expect(bans).toMatch(/lab boards|experiments/);
  });

  it('locks identical proposed payload, preview failure taxonomy, and mid-build UUID inventory', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    const bans = CONTENT_DEVELOPER_HARD_BANS.toLowerCase();
    expect(md).toMatch(
      /identical proposed|same proposed payload|immutable.*proposed|do not (mutate|edit|change).*proposed/,
    );
    expect(bans).toMatch(
      /proposed payload|identical proposed|mutate.*proposed|edit.*after preview/,
    );
    expect(md).toMatch(/content hash/);
    expect(md).toMatch(/preview_stale/);
    expect(md).toMatch(/preview_required/);
    expect(md).toMatch(/invalid or expired/);
    expect(md).toMatch(
      /running inventory|uuid inventory|after each.*create_chart|inventory.*charts\[0\]\.data\.uuid/,
    );
    expect(md).toMatch(/batch sop|one.*update_dashboard/);
    expect(md).toMatch(/avoid n single-tile|do not interleave tiling/);
  });

  it('documents improve/professionalize Spec delta, cull, and leftover handoff', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/professionalize|improve \/ professionalize/);
    expect(md).toMatch(/keep \/ drop \/ rename|keep\/drop\/rename/);
    expect(md).toMatch(/cull/);
    expect(md).toMatch(/untiled|leftover/);
    expect(md).toContain('content-governance');
  });

  it('keeps all-types dashboards decision-oriented and enforces chart semantics', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/decision-oriented|decision section/);
    expect(md).toMatch(/validation appendix|visualization-validation/);
    expect(md).toMatch(/scatter.*two numeric|two numeric.*scatter/);
    expect(md).toMatch(/funnel.*discrete stages|discrete stages.*funnel/);
    expect(md).toMatch(/sankey.*source.*target.*flow/);
    expect(md).toMatch(/pie.*meaningful whole|meaningful whole.*pie/);
    expect(md).toMatch(/area.*total.*parts|total.*parts.*area/);
    expect(md).toMatch(/gauge.*target|target.*gauge/);
  });

  it('documents every supported native map input without permitting fabricated geography', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/iso 3166-1|iso3/);
    expect(md).toMatch(/us state|state code/);
    expect(md).toMatch(/latitude.*longitude|longitude.*latitude/);
    expect(md).toMatch(/do not fabricate|never fabricate/);
  });

  it('documents that a legitimate scatter grain dimension is not a validate_chart defect', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/grain dimension/);
    expect(md).toMatch(/two metric axes/);
    expect(md).toMatch(/validate_chart/);
    expect(md).toMatch(/flag(?:s|ged)? .*unused/);
    expect(md).toMatch(/do not drop the dimension|never drop the dimension/);
  });

  it('documents a canonical proxy-naming template for validation-only funnel\\/sankey charts', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('<metric>');
    expect(md).toContain('<type>');
    expect(md).toMatch(/<funnel\/flow>/);
    expect(md).toMatch(/visualization validation, not a real/);
  });

  it('does not register standalone build_chart or design_dashboard prompt', async () => {
    const { registerContentDeveloperPrompts } = await import('./prompts.js');
    const names: string[] = [];
    const promptArgs: Array<{ name: string; messages: unknown }> = [];
    let publishText = '';
    let authorText = '';
    let authorUris: Array<string | undefined> = [];
    let refactorText = '';
    let createCompactText = '';
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
            content: { type: string; text?: string; resource?: { uri?: string } };
          }>;
          authorText = messages
            .filter((m) => m.content.type === 'text')
            .map((m) => m.content.text ?? '')
            .join('\n')
            .toLowerCase();
          authorUris = messages
            .filter((m) => m.content.type === 'resource')
            .map((m) => m.content.resource?.uri);
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
    // embedded keeps legacy resource URI assertions; compact is the package default.
    registerContentDeveloperPrompts(server as never, { promptContextPolicy: 'embedded' });

    const compactServer = {
      registerPrompt: (
        name: string,
        _meta: unknown,
        handler: (args: Record<string, unknown>) => { messages: unknown },
      ) => {
        if (name !== 'create_dashboard') return;
        const messages = handler({ goal: 'x' }).messages as Array<{
          content: { type: string; text?: string };
        }>;
        createCompactText = messages
          .filter((m) => m.content.type === 'text')
          .map((m) => m.content.text ?? '')
          .join('\n')
          .toLowerCase();
        expect(messages.every((m) => m.content.type === 'text')).toBe(true);
      },
    };
    registerContentDeveloperPrompts(compactServer as never, { promptContextPolicy: 'compact' });
    expect(createCompactText).toContain('critical invariants:');
    expect(createCompactText).toContain('previewtoken');
    expect(createCompactText).toContain(
      playbookTopicUri('content-developer', 'recovery/preview-stale'),
    );
    expect(createCompactText).not.toContain('## hard bans');

    let moveCompactText = '';
    const moveCompactServer = {
      registerPrompt: (
        name: string,
        _meta: unknown,
        handler: (args: Record<string, unknown>) => { messages: unknown },
      ) => {
        if (name !== 'move_content') return;
        const messages = handler({ goal: 'x' }).messages as Array<{
          content: { type: string; text?: string };
        }>;
        moveCompactText = messages
          .filter((m) => m.content.type === 'text')
          .map((m) => m.content.text ?? '')
          .join('\n')
          .toLowerCase();
      },
    };
    registerContentDeveloperPrompts(moveCompactServer as never, { promptContextPolicy: 'compact' });
    expect(moveCompactText).toContain(
      playbookTopicUri('content-developer', 'recovery/preview-stale'),
    );
    expect(moveCompactText).toContain(
      playbookTopicUri('content-developer', 'recovery/preview-required'),
    );

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
      expect(text).toContain('critical invariants:');
      expect(text).toContain('previewtoken');

      const uris = typed
        .filter((m) => m.content.type === 'resource')
        .map((m) => m.content.resource?.uri);
      expect(uris).toContain(CONTENT_DEVELOPER_CORE_PLAYBOOK.uri);
      expect(uris).toContain(CONTENT_DEVELOPER_TOPIC_PLAYBOOKS.dashboards.uri);
      expect(uris).toContain(CONTENT_DEVELOPER_TOPIC_PLAYBOOKS['dashboard-design'].uri);
      if (name === 'create_dashboard' || name === 'improve_dashboard') {
        expect(text).toContain('objective');
        expect(text).toMatch(/clarif/);
        expect(text).toMatch(/only if the user explicitly asked/);
        expect(text).toMatch(/tablename|filter apply\/exclude|apply\/exclude/);
        expect(uris).toContain(CONTENT_DEVELOPER_TOPIC_PLAYBOOKS['chart-types'].uri);
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
    expect(authorText).toContain('table-calculations');
    expect(authorUris).toContain(CONTENT_DEVELOPER_TOPIC_PLAYBOOKS['chart-types'].uri);
    expect(authorUris).toContain(CONTENT_DEVELOPER_TOPIC_PLAYBOOKS['table-calculations'].uri);
    expect(refactorText).toMatch(/approved spec|user request allows/);
    expect(refactorText).not.toMatch(/unless explicitly requested/);
  });
});
