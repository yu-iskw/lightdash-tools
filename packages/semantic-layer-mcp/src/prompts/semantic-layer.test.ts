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

    const resourceMsg = result.messages[1];
    expect(resourceMsg.content.type).toBe('resource');
    expect(resourceMsg.content.resource?.uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
    expect(resourceMsg.content.resource?.text).toContain('compile_query');
  });

  it('explore and compile_debug prompts include project and playbook URI', async () => {
    registerSemanticLayerPrompts(server);

    const exploreHandler = registerPromptSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'lightdash_semantic_explore',
    )![2] as (args: { projectUuid: string }) => Promise<{
      messages: Array<{ content: { type: string; text?: string; resource?: { uri: string } } }>;
    }>;

    const explore = await exploreHandler({ projectUuid: 'p-explore' });
    expect(explore.messages[0].content.text).toContain('p-explore');
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
    expect(debug.messages[1].content.resource?.uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
  });
});
