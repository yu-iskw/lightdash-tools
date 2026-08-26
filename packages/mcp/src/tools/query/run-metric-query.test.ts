/**
 * run_metric_query registration and handler tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import {
  runWithMcpClientSessionAsync,
  resolveMcpClientSessionId,
} from '../../governance/mcp-client-session.js';
import { resetQueryBudgetsForTests } from '../../policy/result-limits.js';

import { resetQueryLedgerForTests } from './query-ledger.js';
import { registerRunMetricQuery } from './run-metric-query.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PROJECT = '550e8400-e29b-41d4-a716-446655440000';

describe('registerRunMetricQuery', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
    vi.restoreAllMocks();
  });

  it('passes clamped limit to runMetricQuery and returns bounded envelope', async () => {
    const runMetricQuery = vi.fn().mockResolvedValue({ queryUuid: 'q-metric' });
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q-metric',
      status: 'ready',
      columns: {},
      rows: [{ orders_order_id: 1 }],
      totalResults: 1,
    });

    const contextProvider = {
      getContext: async () => ({
        lightdashClient: {
          v2: { query: { runMetricQuery, getAsyncQueryResults } },
        },
        auth: { mode: 'none' as const },
      }),
    } as unknown as McpContextProvider;

    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'data-analyst');
    registerRunMetricQuery(mockServer as never, contextProvider);
    const [toolName, , handler] = mockServer.registerTool.mock.calls[0];
    expect(toolName).toBe('lightdash_run_metric_query');

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-analyst-1' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await handler({
        projectUuid: PROJECT,
        exploreName: 'orders',
        dimensions: ['orders_order_date_day'],
        metrics: ['orders_order_count'],
        sorts: [{ fieldId: 'orders_order_date_day', descending: true }],
        limit: 50,
        waitForResults: true,
        timeoutMs: 5_000,
      });

      expect(result.isError).toBeUndefined();
      expect(runMetricQuery).toHaveBeenCalledWith(
        PROJECT,
        expect.objectContaining({
          context: 'mcp.run_metric_query',
          query: expect.objectContaining({
            exploreName: 'orders',
            dimensions: ['orders_order_date_day'],
            metrics: ['orders_order_count'],
            limit: 50,
            tableCalculations: [],
          }),
        }),
      );

      const body = JSON.parse(result.content[0].text) as {
        data: { queryUuid: string; status: string; rows?: unknown };
        context: { profile: string; projectUuid: string };
        coverage: { complete: boolean };
        artifacts: Array<{ kind: string; included: boolean }>;
      };
      expect(body.data.queryUuid).toBe('q-metric');
      expect(body.data.status).toBe('complete');
      expect(body.data.rows).toBeUndefined();
      expect(body.context.profile).toBe('data-analyst');
      expect(body.context.projectUuid).toBe(PROJECT);
      expect(body.coverage.complete).toBe(true);
      expect(body.artifacts).toEqual([expect.objectContaining({ kind: 'data', included: true })]);
      const dataPart = result.content.find(
        (c: { type?: string; resource?: { mimeType?: string; text?: string } }) =>
          c.type === 'resource' && c.resource?.mimeType === 'application/json',
      );
      expect(dataPart?.resource?.text).toContain('orders_order_id');
    });
  });

  it('rejects limit above hard maximum', async () => {
    const runMetricQuery = vi.fn();
    const contextProvider = {
      getContext: async () => ({
        lightdashClient: { v2: { query: { runMetricQuery } } },
        auth: { mode: 'none' as const },
      }),
    } as unknown as McpContextProvider;

    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'data-analyst');
    registerRunMetricQuery(mockServer as never, contextProvider);
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({
      projectUuid: PROJECT,
      exploreName: 'orders',
      dimensions: [],
      metrics: ['orders_order_count'],
      limit: 50_000,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('ROW_LIMIT_EXCEEDED');
    expect(runMetricQuery).not.toHaveBeenCalled();
  });

  it('returns PROJECT_SCOPE_REQUIRED without pin or projectUuid', async () => {
    const runMetricQuery = vi.fn();
    const contextProvider = {
      getContext: async () => ({
        lightdashClient: { v2: { query: { runMetricQuery } } },
        auth: { mode: 'none' as const },
      }),
    } as unknown as McpContextProvider;

    const mockServer = { registerTool: vi.fn() };
    bindServerProfile(mockServer, 'data-analyst');
    registerRunMetricQuery(mockServer as never, contextProvider);
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({
      exploreName: 'orders',
      dimensions: [],
      metrics: ['orders_order_count'],
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('PROJECT_SCOPE_REQUIRED');
    expect(runMetricQuery).not.toHaveBeenCalled();
  });
});
