/**
 * Unit tests for content-reader content helpers and list_verified_content.
 */

import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';

import { registerListVerifiedContent, toReaderTableCalculation } from './reader-content.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PROJECT = '3dda11cb-aac8-42f7-82f1-26fa6b1afa80';

function mockContext(listVerifiedContent: ReturnType<typeof vi.fn>): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {
        v1: { projects: { listVerifiedContent } },
      },
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

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

describe('registerListVerifiedContent', () => {
  it('returns typed items envelope without count or kind rename', async () => {
    const chart = {
      contentType: 'chart' as const,
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
      chartKind: 'vertical_bar' as const,
      exploreName: 'orders',
    };
    const listVerifiedContent = vi.fn().mockResolvedValue([chart]);
    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'content-reader');
    registerListVerifiedContent(mockServer as never, mockContext(listVerifiedContent));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PROJECT });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text) as {
      data: { items: unknown[]; count?: unknown };
      context: { profile: string; projectUuid: string };
    };
    expect(body.context.profile).toBe('content-reader');
    expect(body.context.projectUuid).toBe(PROJECT);
    expect(body.data.items).toEqual([chart]);
    expect(body.data).not.toHaveProperty('count');
    expect(body.data.items[0]).toMatchObject({ contentType: 'chart' });
    expect(body.data.items[0]).not.toHaveProperty('kind');
    expect(listVerifiedContent).toHaveBeenCalledWith(PROJECT);
  });
});
