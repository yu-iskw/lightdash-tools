/**
 * Unit tests for get_chart table-calculation pass-through and dashboard tile flags.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyDashboardTile,
  toReaderDashboard,
  toReaderTableCalculation,
} from './reader-content.js';

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

describe('classifyDashboardTile', () => {
  it('treats saved_chart as executable by type', () => {
    expect(classifyDashboardTile('saved_chart', {})).toEqual({ kind: 'saved_chart' });
  });

  it('requires savedSqlUuid for sql_chart', () => {
    expect(classifyDashboardTile('sql_chart', { savedSqlUuid: 'sql-1' })).toEqual({
      kind: 'sql_chart',
      savedSqlUuid: 'sql-1',
    });
    expect(classifyDashboardTile('sql_chart', {})).toEqual({
      kind: 'not_executable',
      tileType: 'sql_chart',
      reason: 'missing_saved_sql_uuid',
    });
  });

  it('rejects markdown and unknown types', () => {
    expect(classifyDashboardTile('markdown', {})).toEqual({
      kind: 'not_executable',
      tileType: 'markdown',
      reason: 'unsupported_type',
    });
  });
});

describe('toReaderDashboard', () => {
  it('marks sql_chart tiles executable when savedSqlUuid is present', () => {
    const mapped = toReaderDashboard(
      {
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
      },
      true,
    );
    expect(mapped.tiles).toEqual(
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
