import { describe, expect, it, vi } from 'vitest';

import { jsonToolResult, wrapTool } from './shared.js';

import type { McpContextProvider } from '../request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';

describe('jsonToolResult', () => {
  it('pretty-prints JSON text content', () => {
    expect(jsonToolResult({ ok: true })).toEqual({
      content: [{ type: 'text', text: '{\n  "ok": true\n}' }],
    });
  });
});

describe('wrapTool', () => {
  it('returns client payload for compile_query-shaped handler', async () => {
    const compileQuery = vi.fn().mockResolvedValue({ query: 'SELECT 1' });
    const client = {
      v1: { query: { compileQuery } },
    } as unknown as LightdashClient;
    const contextProvider: McpContextProvider = {
      getContext: async () => ({
        lightdashClient: client,
        auth: { mode: 'env' },
        governance: {},
      }),
    };

    const handler = wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          exploreId,
          metricQuery,
        }: {
          projectUuid: string;
          exploreId: string;
          metricQuery: Record<string, unknown>;
        }) => {
          const result = await c.v1.query.compileQuery(
            projectUuid,
            exploreId,
            metricQuery as never,
          );
          return jsonToolResult(result);
        },
    );

    const result = await handler({
      projectUuid: 'p1',
      exploreId: 'orders',
      metricQuery: { metrics: ['orders.count'] },
    });

    expect(compileQuery).toHaveBeenCalledWith('p1', 'orders', { metrics: ['orders.count'] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('SELECT 1');
  });

  it('maps thrown errors to isError results', async () => {
    const contextProvider: McpContextProvider = {
      getContext: async () => {
        throw new Error('boom');
      },
    };

    const handler = wrapTool(contextProvider, () => async () => jsonToolResult({}));
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('boom');
  });

  it('returns list_explores payload from mocked client', async () => {
    const listExplores = vi.fn().mockResolvedValue([{ name: 'orders' }]);
    const client = {
      v1: { explores: { listExplores } },
    } as unknown as LightdashClient;
    const contextProvider: McpContextProvider = {
      getContext: async () => ({
        lightdashClient: client,
        auth: { mode: 'env' },
        governance: {},
      }),
    };

    const handler = wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid }: { projectUuid: string }) => {
          return jsonToolResult(await c.v1.explores.listExplores(projectUuid));
        },
    );

    const result = await handler({ projectUuid: 'p1' });
    expect(listExplores).toHaveBeenCalledWith('p1');
    expect(result.content[0].text).toContain('orders');
  });
});
