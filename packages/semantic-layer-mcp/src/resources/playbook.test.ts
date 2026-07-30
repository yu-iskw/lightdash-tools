import { McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPlaybookMarkdownCache,
  getPlaybookMarkdown,
  registerPlaybookResource,
  SEMANTIC_LAYER_PLAYBOOK_MIME,
  SEMANTIC_LAYER_PLAYBOOK_NAME,
  SEMANTIC_LAYER_PLAYBOOK_URI,
} from './playbook.js';

describe('registerPlaybookResource', () => {
  let server: McpServer;
  let registerResourceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPlaybookMarkdownCache();
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerResourceSpy = vi.spyOn(server, 'registerResource');
  });

  it('registers the fixed semantic-layer playbook URI', () => {
    registerPlaybookResource(server);

    expect(registerResourceSpy).toHaveBeenCalledTimes(1);
    const [name, uri, metadata] = registerResourceSpy.mock.calls[0];
    expect(name).toBe(SEMANTIC_LAYER_PLAYBOOK_NAME);
    expect(uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
    expect(metadata).toMatchObject({
      mimeType: SEMANTIC_LAYER_PLAYBOOK_MIME,
    });
  });

  it('read handler returns markdown with bans and compile_query', async () => {
    registerPlaybookResource(server);

    const readCallback = registerResourceSpy.mock.calls[0][3] as (
      uri: URL | string,
    ) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

    const result = await readCallback(SEMANTIC_LAYER_PLAYBOOK_URI);
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe(SEMANTIC_LAYER_PLAYBOOK_URI);
    expect(result.contents[0].mimeType).toBe(SEMANTIC_LAYER_PLAYBOOK_MIME);
    expect(result.contents[0].text).toContain('compile_query');
    expect(result.contents[0].text).toMatch(/Hard bans/i);
    expect(result.contents[0].text).toMatch(/SQL runner/i);
  });

  it('getPlaybookMarkdown lists only registered MVP tools', () => {
    const md = getPlaybookMarkdown();
    expect(md).toContain('Allowed tools');
    expect(md).toContain('compile_query');
    expect(md).toContain('get_metric');
    expect(md).toContain('list_explores');
    expect(md).not.toContain('search_field_values');
    expect(md).not.toMatch(/catalog helpers/i);
  });
});
