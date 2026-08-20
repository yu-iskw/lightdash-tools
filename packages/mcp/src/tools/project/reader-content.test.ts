/**
 * Unit tests for get_chart table-calculation pass-through and dashboard tile mapping.
 */

import { describe, expect, it } from 'vitest';

import { TOOL_PREFIX } from '../shared.js';

import {
  mapReaderDashboardTile,
  toReaderSearchItem,
  toReaderTableCalculation,
} from './reader-content.js';

const DASHBOARD_UUID = 'dash-uuid-1';

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

describe('toReaderSearchItem', () => {
  it('omits space membership access lists', () => {
    expect(
      toReaderSearchItem({
        contentType: 'space',
        uuid: 'space-1',
        name: 'アプリ',
        access: ['user-a', 'user-b'],
        dashboardCount: 4,
      }),
    ).toEqual({
      contentType: 'space',
      uuid: 'space-1',
      name: 'アプリ',
      dashboardCount: 4,
    });
  });
});

describe('mapReaderDashboardTile', () => {
  const expectedRun = {
    tool: `${TOOL_PREFIX}run_dashboard_tile`,
    arguments: {
      dashboardUuidOrSlug: DASHBOARD_UUID,
      tileUuid: 'tile-1',
    },
  };

  it('maps sql_chart without chartUuid and with a run handle', () => {
    expect(
      mapReaderDashboardTile(
        {
          uuid: 'tile-1',
          tabUuid: 'tab-a',
          type: 'sql_chart',
          properties: {
            savedSqlUuid: 'saved-sql-1',
            chartSlug: 'cost-daily',
            chartName: 'Daily cost',
            chartKind: 'line',
            title: 'Cost',
          },
        },
        DASHBOARD_UUID,
      ),
    ).toEqual({
      tileUuid: 'tile-1',
      tabUuid: 'tab-a',
      type: 'sql_chart',
      title: 'Cost',
      chartSlug: 'cost-daily',
      chartName: 'Daily cost',
      chartKind: 'line',
      savedSqlUuid: 'saved-sql-1',
      executable: true,
      run: expectedRun,
    });
  });

  it('maps saved_chart with chartUuid from savedChartUuid and a run handle', () => {
    expect(
      mapReaderDashboardTile(
        {
          uuid: 'tile-1',
          type: 'saved_chart',
          properties: {
            savedChartUuid: 'chart-sem-1',
            chartSlug: 'app-dau',
            chartName: 'App DAU',
            chartKind: 'big_number',
          },
        },
        DASHBOARD_UUID,
      ),
    ).toEqual({
      tileUuid: 'tile-1',
      tabUuid: undefined,
      type: 'saved_chart',
      title: 'App DAU',
      chartUuid: 'chart-sem-1',
      chartSlug: 'app-dau',
      chartName: 'App DAU',
      chartKind: 'big_number',
      executable: true,
      run: expectedRun,
    });
  });

  it('maps markdown as non-executable without run', () => {
    expect(
      mapReaderDashboardTile(
        {
          uuid: 'tile-md',
          type: 'markdown',
          properties: {
            title: 'Notes',
            content: 'Hello',
          },
        },
        DASHBOARD_UUID,
      ),
    ).toEqual({
      tileUuid: 'tile-md',
      tabUuid: undefined,
      type: 'markdown',
      title: 'Notes',
      chartSlug: undefined,
      chartName: undefined,
      chartKind: undefined,
      executable: false,
    });
  });

  it('never aliases savedSqlUuid into chartUuid', () => {
    const mapped = mapReaderDashboardTile(
      {
        uuid: 'tile-1',
        type: 'sql_chart',
        properties: {
          savedSqlUuid: 'saved-sql-1',
          chartSlug: 'cost',
          chartName: 'Cost',
        },
      },
      DASHBOARD_UUID,
    );
    expect(mapped).not.toHaveProperty('chartUuid');
    expect(mapped.savedSqlUuid).toBe('saved-sql-1');
  });
});
