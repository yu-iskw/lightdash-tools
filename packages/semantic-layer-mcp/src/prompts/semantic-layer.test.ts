import { McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPlaybookMarkdownCache, SEMANTIC_LAYER_PLAYBOOK_URI } from '../resources/playbook.js';

import { registerSemanticLayerPrompts } from './semantic-layer.js';

describe('registerSemanticLayerPrompts', () => {
  let server: McpServer;
  let registerPromptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPlaybookMarkdownCache();
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerPromptSpy = vi.spyOn(server, 'registerPrompt');
  });

  it('registers exactly three prompts', () => {
    registerSemanticLayerPrompts(server);
    expect(registerPromptSpy).toHaveBeenCalledTimes(3);
    const names = registerPromptSpy.mock.calls.map((call: unknown[]) => call[0]);
    expect(names).toEqual([
      'lightdash_semantic_explore',
      'lightdash_semantic_compose_compile',
      'lightdash_semantic_compile_debug',
    ]);
  });

  it('compose_compile prompt embeds playbook and forbids running queries', async () => {
    registerSemanticLayerPrompts(server);

    const composeCall = registerPromptSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'lightdash_semantic_compose_compile',
    );
    expect(composeCall).toBeDefined();
    const handler = composeCall![2] as (args: {
      projectUuid: string;
      question?: string;
      exploreId?: string;
    }) => Promise<{
      messages: Array<{
        role: string;
        content: { type: string; text?: string; resource?: { uri: string; text: string } };
      }>;
    }>;

    const result = await handler({
      projectUuid: 'proj-1',
      question: 'revenue by week',
      exploreId: 'orders',
    });

    expect(result.messages).toHaveLength(2);
    const textMsg = result.messages[0];
    expect(textMsg.content.type).toBe('text');
    expect(textMsg.content.text).toContain('proj-1');
    expect(textMsg.content.text).toMatch(/Do not run/i);
    expect(textMsg.content.text).toMatch(/SQL/i);
    expect(textMsg.content.text).toContain('compile_query');
    expect(textMsg.content.text).toContain('{table}_{name}');
    expect(textMsg.content.text).toMatch(/empty SELECT/i);
    expect(textMsg.content.text).toMatch(/tableName === explore id/i);
    expect(textMsg.content.text).toMatch(/base-table/i);
    expect(textMsg.content.text).toMatch(/list_dimensions/i);
    expect(textMsg.content.text).toContain('Stop after compile_query');
    expect(textMsg.content.text).not.toContain('search_field_values');

    const resourceMsg = result.messages[1];
    expect(resourceMsg.content.type).toBe('resource');
    expect(resourceMsg.content.resource?.uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
    expect(resourceMsg.content.resource?.text).toContain('compile_query');
    expect(resourceMsg.content.resource?.text).toContain('{table}_{name}');
    expect(resourceMsg.content.resource?.text).toContain('Always search');
    expect(resourceMsg.content.resource?.text).toContain('Explore disambiguation');
    expect(resourceMsg.content.resource?.text).toContain('Prefer base-table fields');
    expect(resourceMsg.content.resource?.text).toContain('empty `SELECT`');
    expect(resourceMsg.content.resource?.text).not.toContain('search_field_values');
  });

  it('explore and compile_debug prompts include project, playbook URI, and postmortem cues', async () => {
    registerSemanticLayerPrompts(server);

    const exploreHandler = registerPromptSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'lightdash_semantic_explore',
    )![2] as (args: { projectUuid: string }) => Promise<{
      messages: Array<{ content: { type: string; text?: string; resource?: { uri: string } } }>;
    }>;

    const explore = await exploreHandler({ projectUuid: 'p-explore' });
    expect(explore.messages[0].content.text).toContain('p-explore');
    expect(explore.messages[0].content.text).toMatch(/shortlist/i);
    expect(explore.messages[0].content.text).toMatch(/search hints/i);
    expect(explore.messages[0].content.text).toMatch(/Always use list_explores with search/i);
    expect(explore.messages[0].content.text).toMatch(/Disambiguate/i);
    expect(explore.messages[0].content.text).toMatch(/tableName === chosen explore id/i);
    expect(explore.messages[0].content.text).toContain('{table}_{name}');
    expect(explore.messages[1].content.resource?.uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);

    const debugHandler = registerPromptSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'lightdash_semantic_compile_debug',
    )![2] as (args: { projectUuid: string; exploreId: string; errorText?: string }) => Promise<{
      messages: Array<{ content: { type: string; text?: string; resource?: { uri: string } } }>;
    }>;

    const debug = await debugHandler({
      projectUuid: 'p-debug',
      exploreId: 'ex-1',
      errorText: 'unknown field',
    });
    expect(debug.messages[0].content.text).toContain('p-debug');
    expect(debug.messages[0].content.text).toContain('ex-1');
    expect(debug.messages[0].content.text).toContain('unknown field');
    expect(debug.messages[0].content.text).toContain('{table}_{name}');
    expect(debug.messages[0].content.text).toMatch(/Empty SELECT/i);
    expect(debug.messages[0].content.text).toMatch(/get_field_lineage/i);
    expect(debug.messages[0].content.text).toMatch(/explore id/i);
    expect(debug.messages[1].content.resource?.uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
  });
});
