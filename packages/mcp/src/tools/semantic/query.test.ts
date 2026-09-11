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

  it('returns isError when compiled SQL embeds an ERROR comment', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: `SELECT
  \`orders\`.status AS \`orders_status\`
FROM orders
WHERE ((
  /* ERROR: Filter has a reference to an unknown dimension: orders_customer.first_name */ x
))
GROUP BY 1`,
    });
    const { handler } = createCompileHandler(compileQuery);

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

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ERROR:');
    expect(result.content[0].text).toContain('unknown filter fieldId');
    expect(result.content[0].text).toContain('orders_customer.first_name');
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

  it('defaults missing sorts to []', async () => {
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
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({
        exploreName: 'orders',
        sorts: [],
      }),
    );
  });

  it('preserves explicit sorts', async () => {
    const sorts = [{ fieldId: 'orders_status', descending: true }];
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
        sorts,
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({ sorts }),
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

  it('returns isError when a requested dimension is missing from SELECT aliases', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query:
        'SELECT COUNT(DISTINCT `orders`.order_id) AS `orders_num_unique_order_ids` FROM orders',
    });
    const { handler } = createCompileHandler(compileQuery);

    const result = await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_payments.payment_method'],
        metrics: ['orders_num_unique_order_ids'],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('orders_payments.payment_method');
    expect(result.content[0].text).toContain('missing SELECT aliases');
  });

  it('succeeds when every requested fieldId appears as a SELECT alias', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: `
SELECT
  \`orders\`.payments.payment_method AS \`orders_payments__payment_method\`,
  SUM(\`orders\`.payments.amount) AS \`orders_sum_payment_amount\`
FROM orders
GROUP BY 1`,
    });
    const { handler } = createCompileHandler(compileQuery);

    const result = await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_payments__payment_method'],
        metrics: ['orders_sum_payment_amount'],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('orders_payments__payment_method');
  });

  it('succeeds for double-quoted SELECT aliases (Postgres-style)', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'SELECT status AS "orders_status", COUNT(*) AS "orders_count" FROM orders GROUP BY 1',
    });
    const { handler } = createCompileHandler(compileQuery);

    const result = await handler({
      projectUuid: PROJECT,
      exploreId: 'orders',
      metricQuery: {
        dimensions: ['orders_status'],
        metrics: ['orders_count'],
        filters: {},
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(result.isError).toBeUndefined();
  });

  it('does not isError when alias parse is inconclusive (CTE truncates SELECT list)', async () => {
    const compileQuery = vi.fn().mockResolvedValue({
      query: 'WITH x AS (SELECT 1 FROM dual) SELECT a AS `orders_status` FROM t',
    });
    const { handler } = createCompileHandler(compileQuery);

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
  });

  it('injects missing FilterGroup and FilterRule ids before compile', async () => {
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
        filters: {
          dimensions: {
            and: [
              {
                target: { fieldId: 'orders_status' },
                operator: 'equals',
                values: ['completed'],
              },
            ],
          },
        },
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    const body = compileQuery.mock.calls[0][2] as {
      filters: {
        dimensions: {
          id: string;
          and: Array<{ id: string; target: { fieldId: string } }>;
        };
      };
    };
    expect(body.filters.dimensions.id).toBeTruthy();
    expect(body.filters.dimensions.and[0].id).toBeTruthy();
    expect(body.filters.dimensions.and[0].target.fieldId).toBe('orders_status');
  });

  it('preserves existing filter ids', async () => {
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
        filters: {
          dimensions: {
            id: 'keep-group',
            and: [
              {
                id: 'keep-rule',
                target: { fieldId: 'orders_status' },
                operator: 'equals',
                values: ['shipped'],
              },
            ],
          },
        },
        sorts: [],
        limit: 50,
        tableCalculations: [],
      },
    });

    expect(compileQuery).toHaveBeenCalledWith(
      PROJECT,
      'orders',
      expect.objectContaining({
        filters: {
          dimensions: {
            id: 'keep-group',
            and: [
              expect.objectContaining({
                id: 'keep-rule',
                target: { fieldId: 'orders_status' },
              }),
            ],
          },
        },
      }),
    );
  });
});
