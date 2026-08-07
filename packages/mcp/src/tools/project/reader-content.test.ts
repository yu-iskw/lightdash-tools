/**
 * Unit tests for get_chart table-calculation pass-through.
 */

import { describe, expect, it } from 'vitest';

import { toReaderTableCalculation, toVerifiedContentSummary } from './reader-content.js';

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

describe('toVerifiedContentSummary', () => {
  it('maps chart items with chartKind and exploreName', () => {
    expect(
      toVerifiedContentSummary({
        contentType: 'chart',
        uuid: 'c1',
        contentUuid: 'c1',
        name: 'Orders',
        description: 'Count',
        views: 12,
        spaceUuid: 's1',
        spaceName: 'Finance',
        verifiedAt: '2026-01-01T00:00:00.000Z',
        verifiedBy: { userUuid: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
        lastUpdatedAt: null,
        chartKind: 'vertical_bar',
        exploreName: 'orders',
      }),
    ).toEqual({
      kind: 'chart',
      name: 'Orders',
      uuid: 'c1',
      contentUuid: 'c1',
      description: 'Count',
      views: 12,
      spaceUuid: 's1',
      spaceName: 'Finance',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      verifiedBy: { userUuid: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
      lastUpdatedAt: null,
      chartKind: 'vertical_bar',
      exploreName: 'orders',
    });
  });

  it('maps dashboard items without chart fields', () => {
    expect(
      toVerifiedContentSummary({
        contentType: 'dashboard',
        uuid: 'd1',
        contentUuid: 'd1',
        name: 'Ops',
        description: null,
        views: 3,
        spaceUuid: 's1',
        spaceName: 'Ops',
        verifiedAt: '2026-02-01T00:00:00.000Z',
        verifiedBy: { userUuid: 'u2', firstName: 'Grace', lastName: 'Hopper' },
        lastUpdatedAt: '2026-02-02T00:00:00.000Z',
      }),
    ).toEqual({
      kind: 'dashboard',
      name: 'Ops',
      uuid: 'd1',
      contentUuid: 'd1',
      description: null,
      views: 3,
      spaceUuid: 's1',
      spaceName: 'Ops',
      verifiedAt: '2026-02-01T00:00:00.000Z',
      verifiedBy: { userUuid: 'u2', firstName: 'Grace', lastName: 'Hopper' },
      lastUpdatedAt: '2026-02-02T00:00:00.000Z',
    });
  });
});
