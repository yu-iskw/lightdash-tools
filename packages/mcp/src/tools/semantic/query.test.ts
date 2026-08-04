/**
 * compile_query registration and exploreName injection tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';

import { registerCompileQuery } from './query.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PROJECT = '550e8400-e29b-41d4-a716-446655440000';

function createCompileHandler(compileQuery: ReturnType<typeof vi.fn>) {
  const contextProvider = {
    getContext: async () => ({
      lightdashClient: { v1: { query: { compileQuery } } },
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;

  const mockServer = { registerTool: vi.fn() };
  bindServerProfile(mockServer, 'semantic-layer');
  registerCompileQuery(mockServer as never, contextProvider);
  const [toolName, , handler] = mockServer.registerTool.mock.calls[0] as [
    string,
    unknown,
    (
      args: Record<string, unknown>,
    ) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>,
  ];
  return { toolName, handler, compileQuery };
}

describe('registerCompileQuery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets exploreName from exploreId when metricQuery omits it', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT `orders`.status AS `orders_status` FROM orders',
    });
    const { toolName, handler } = createCompileHandler(compileQuery);
    expect(toolName).toBe('lightdash_compile_query');

    const result = await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_status'],
        metrics: [],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({
        exploreName: 'orders',
        dimensions: ['orders_status'],
      }),
    );
  });

  it('overwrites mismatched exploreName with exploreId', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT 1 AS `orders_status`',
    });
    const { handler } = createCompileHandler(compileQuery);

    await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        exploreName: 'customers',
        dimensions: ['orders_status'],
        metrics: [],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({ exploreName: 'orders' }),
    );
  });

  it('returns isError when compiled SQL has an empty SELECT', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT FROM orders',
    });
    const { handler } = createCompileHandler(compileQuery);

    const result = await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['bad_id'],
        metrics: [],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('empty SELECT');
  });

  it('defaults missing tableCalculations to []', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT `orders`.status AS `orders_status` FROM orders',
    });
    const { handler } = createCompileHandler(compileQuery);

    await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_status'],
        metrics: [],
        filters: {},
        sorts: [],
        limit: 50,
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({
        exploreName: 'orders',
        tableCalculations: [],
      }),
    );
  });

  it('preserves explicit tableCalculations', async () => {
    const tableCalculations = [
      { name: 'ratio', displayName: 'Ratio', sql: '${orders_sum_order_amount} / 100' },
    ];
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT 1 AS `orders_status`',
    });
    const { handler } = createCompileHandler(compileQuery);

    await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_status'],
        metrics: [],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations,
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({ tableCalculations }),
    );
  });
});
