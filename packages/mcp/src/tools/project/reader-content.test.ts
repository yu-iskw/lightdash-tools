/**
 * Unit tests for get_chart table-calculation pass-through and dashboard tile flags.
 */

import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';

import { registerGetDashboard, toReaderTableCalculation } from './reader-content.js';

import type { McpContextProvider } from '../../server/request-context.js';

describe('toReaderTableCalculation', () => {
  it('preserves formula table calculations', () => {
    expect(
      toReaderTableCalculation({
        name: 'revenue_running_total',
        displayName: 'Running total',
        type: 'number',
        totalMode: 'sum_of_rows',
        formula: '=RUNNING_TOTAL(orders_total_order_amount)',
        index: 0,
      }),
    ).toEqual({
      name: 'revenue_running_total',
      displayName: 'Running total',
      type: 'number',
      totalMode: 'sum_of_rows',
      formula: '=RUNNING_TOTAL(orders_total_order_amount)',
      index: 0,
    });
  });

  it('preserves template table calculations', () => {
    expect(
      toReaderTableCalculation({
        name: 'revenue_pct_change',
        displayName: '% change vs previous',
        type: 'number',
        format: { type: 'percent' },
        totalMode: 'sum_of_rows',
        template: {
          type: 'percent_change_from_previous',
          fieldId: 'orders_total_order_amount',
          orderBy: [{ fieldId: 'orders_order_date_week', order: 'asc' }],
        },
      }),
    ).toEqual({
      name: 'revenue_pct_change',
      displayName: '% change vs previous',
      type: 'number',
      format: { type: 'percent' },
      totalMode: 'sum_of_rows',
      template: {
        type: 'percent_change_from_previous',
        fieldId: 'orders_total_order_amount',
        orderBy: [{ fieldId: 'orders_order_date_week', order: 'asc' }],
      },
    });
  });

  it('preserves sql table calculations', () => {
    expect(
      toReaderTableCalculation({
        name: 'pct_of_total',
        displayName: '% of total',
        sql: '${orders.total_order_amount} / total(${orders.total_order_amount})',
        format: { type: 'percent' },
      }),
    ).toEqual({
      name: 'pct_of_total',
      displayName: '% of total',
      format: { type: 'percent' },
      sql: '${orders.total_order_amount} / total(${orders.total_order_amount})',
    });
  });
});

describe('registerGetDashboard', () => {
  it('marks sql_chart tiles executable when savedSqlUuid is present', async () => {
    const getDashboard = vi.fn().mockResolvedValue({
      uuid: 'aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      name: 'App',
      tiles: [
        {
          uuid: 'tile-sql',
          type: 'sql_chart',
          properties: { savedSqlUuid: 'sql-1', chartName: 'SQL KPI' },
        },
        {
          uuid: 'tile-sql-missing',
          type: 'sql_chart',
          properties: { chartName: 'Broken' },
        },
        {
          uuid: 'tile-sem',
          type: 'saved_chart',
          properties: { savedChartUuid: 'chart-1', chartName: 'Revenue' },
        },
        {
          uuid: 'tile-md',
          type: 'markdown',
          properties: { title: 'Notes' },
        },
      ],
    });
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerGetDashboard(
      mockServer as never,
      {
        getContext: async () => ({
          lightdashClient: { v2: { dashboards: { getDashboard } } },
          auth: { mode: 'none' as const },
        }),
      } as unknown as McpContextProvider,
    );
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({
      projectUuid: '550e8400-e29b-41d4-a716-446655440000',
      dashboardUuidOrSlug: 'aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      includeTiles: true,
    });
    const body = JSON.parse(result.content[0].text) as {
      data: { tiles: Array<Record<string, unknown>> };
    };
    expect(body.data.tiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileUuid: 'tile-sql',
          type: 'sql_chart',
          savedSqlUuid: 'sql-1',
          executable: true,
        }),
        expect.objectContaining({
          tileUuid: 'tile-sql-missing',
          type: 'sql_chart',
          executable: false,
        }),
        expect.objectContaining({
          tileUuid: 'tile-sem',
          type: 'saved_chart',
          executable: true,
        }),
        expect.objectContaining({
          tileUuid: 'tile-md',
          type: 'markdown',
          executable: false,
        }),
      ]),
    );
  });
});
