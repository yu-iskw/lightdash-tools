import { McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerTools } from './index.js';

import type { McpContextProvider } from '../request-context.js';

const MVP_TOOL_NAMES = [
  'list_projects',
  'get_project',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'get_field_lineage',
  'list_metrics',
  'get_metric',
  'compile_query',
] as const;

describe('registerTools', () => {
  let server: McpServer;
  let registerToolSpy: ReturnType<typeof vi.spyOn>;
  const contextProvider = {
    getContext: async () => {
      throw new Error('unused');
    },
  } satisfies McpContextProvider;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerToolSpy = vi.spyOn(server, 'registerTool');
  });

  it('registers exactly the nine MVP tools', () => {
    registerTools(server, contextProvider);
    expect(registerToolSpy).toHaveBeenCalledTimes(MVP_TOOL_NAMES.length);
    const names = registerToolSpy.mock.calls.map((call: unknown[]) => call[0]);
    expect(names).toEqual([...MVP_TOOL_NAMES]);
  });
});
