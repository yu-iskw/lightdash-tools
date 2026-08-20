/**
 * Content-reader prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { registerContentReaderPrompts } from './prompts.js';
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
    expect(md).toContain('sql runner');
    expect(md).toContain('opaque');
  });

  it('playbook documents tile.run and forbids run_chart on tile chartUuid', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('tile.run');
    expect(md).toContain('never `run_chart(tile.chartuuid)`');
    expect(md).toContain('sql tiles have no `chartuuid`');
  });

  it('summarize_dashboard instructs copying tile run handles', () => {
    let summarizeText = '';
    const server = {
      registerPrompt: (
        name: string,
        _meta: unknown,
        handler: (args: Record<string, unknown>) => {
          messages: Array<{ content: { type: string; text?: string } }>;
        },
      ) => {
        if (name !== 'summarize_dashboard') {
          return;
        }
        const messages = handler({ dashboardUuidOrSlug: 'dash-1' }).messages;
        summarizeText = messages
          .filter((m) => m.content.type === 'text')
          .map((m) => m.content.text ?? '')
          .join('\n')
          .toLowerCase();
      },
    };
    registerContentReaderPrompts(server as never, { promptContextPolicy: 'compact' });
    expect(summarizeText).toContain('run handle');
    expect(summarizeText).toContain('run_dashboard_tile');
    expect(summarizeText).toMatch(/do not pass chartuuid/);
  });
});
