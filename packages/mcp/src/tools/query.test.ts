import { SafetyMode } from '@lightdash-tools/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { registerQueryTools } from './query';
import { TOOL_PREFIX } from './shared';

import type { McpContextProvider } from '../request-context';
import type { LightdashClient } from '@lightdash-tools/client';

function makeResultRow(value: number) {
  return { a: { value: { raw: value, formatted: String(value) } } };
}

describe('run_metric_query', () => {
  const mockServer = { registerTool: vi.fn() };
  const runMetricQuery = vi.fn();
  const getAsyncQueryResults = vi.fn();
  const cancelAsyncQuery = vi.fn();

  const contextProvider: McpContextProvider = {
    getContext: async () => ({
      lightdashClient: {
        v1: { query: { compileQuery: vi.fn() } },
        v2: { query: { runMetricQuery, getAsyncQueryResults, cancelAsyncQuery } },
      } as unknown as LightdashClient,
      auth: { mode: 'env' },
      governance: {
        safetyMode: SafetyMode.READ_ONLY,
        dryRun: false,
        allowedProjectUuids: [],
      },
    }),
  };

  beforeEach(() => {
    mockServer.registerTool.mockClear();
    runMetricQuery.mockReset();
    getAsyncQueryResults.mockReset();
    cancelAsyncQuery.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getHandler(): (args: unknown) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }> {
    registerQueryTools(mockServer as never, contextProvider);
    const call = mockServer.registerTool.mock.calls.find(
      ([name]) => name === `${TOOL_PREFIX}run_metric_query`,
    );
    if (!call) throw new Error(`${TOOL_PREFIX}run_metric_query was not registered`);
    return call[2] as never;
  }

  it('maps exploreId + metricQuery into the v2 request body and returns ready rows on the first poll', async () => {
    runMetricQuery.mockResolvedValue({
      queryUuid: 'q1',
      fields: { a: { type: 'dimension' } },
      metricQuery: { exploreName: 'fact_order', dimensions: ['a'] },
    });
    getAsyncQueryResults.mockResolvedValue({
      status: 'ready',
      queryUuid: 'q1',
      rows: [makeResultRow(1)],
      columns: { a: { type: 'string', reference: 'a' } },
      page: 1,
      pageSize: 500,
      totalResults: 1,
      totalPageCount: 1,
    });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'fact_order',
      metricQuery: { dimensions: ['a'] },
    });

    expect(runMetricQuery).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', {
      context: 'mcp.run_metric_query',
      query: { dimensions: ['a'], exploreName: 'fact_order' },
    });
    expect(getAsyncQueryResults).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'q1',
      { page: 1, pageSize: 500 },
    );
    expect(result.isError).toBeUndefined();

    const payload = JSON.parse(result.content[0].text);
    expect(payload.rows).toHaveLength(1);
    expect(payload.totalResults).toBe(1);
    expect(payload.truncated).toBe(false);
    expect(payload.fields).toEqual({ a: { type: 'dimension' } });
  });

  it('polls through pending -> queued -> executing before returning ready rows', async () => {
    vi.useFakeTimers();
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults
      .mockResolvedValueOnce({ status: 'pending', queryUuid: 'q1' })
      .mockResolvedValueOnce({ status: 'queued', queryUuid: 'q1' })
      .mockResolvedValueOnce({ status: 'executing', queryUuid: 'q1' })
      .mockResolvedValueOnce({
        status: 'ready',
        queryUuid: 'q1',
        rows: [],
        columns: {},
        page: 1,
        pageSize: 500,
        totalResults: 0,
        totalPageCount: 1,
      });

    const handler = getHandler();
    const promise = handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(getAsyncQueryResults).toHaveBeenCalledTimes(4);
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.truncated).toBe(false);
  });

  it('surfaces an error status as a tool error with the Lightdash-side message (RBAC denial shape)', async () => {
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults.mockResolvedValue({
      status: 'error',
      queryUuid: 'q1',
      error: "You don't have authorization to access this explore",
    });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'fact_tweet',
      metricQuery: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("You don't have authorization to access this explore");
  });

  it('surfaces an expired status as a tool error', async () => {
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults.mockResolvedValue({
      status: 'expired',
      queryUuid: 'q1',
      error: 'Query results expired',
    });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Query results expired');
  });

  it('surfaces a cancelled status as a tool error', async () => {
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults.mockResolvedValue({
      status: 'cancelled',
      queryUuid: 'q1',
    });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('cancelled');
  });

  it('paginates across pages and truncates at the 500-row cap', async () => {
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    const page1Rows = Array.from({ length: 300 }, (_, i) => makeResultRow(i));
    const page2Rows = Array.from({ length: 300 }, (_, i) => makeResultRow(300 + i));
    getAsyncQueryResults
      .mockResolvedValueOnce({
        status: 'ready',
        queryUuid: 'q1',
        rows: page1Rows,
        columns: {},
        page: 1,
        pageSize: 500,
        totalResults: 600,
        totalPageCount: 2,
        nextPage: 2,
      })
      .mockResolvedValueOnce({
        status: 'ready',
        queryUuid: 'q1',
        rows: page2Rows,
        columns: {},
        page: 2,
        pageSize: 500,
        totalResults: 600,
        totalPageCount: 2,
      });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });

    expect(getAsyncQueryResults).toHaveBeenCalledTimes(2);
    expect(getAsyncQueryResults).toHaveBeenNthCalledWith(
      2,
      '11111111-1111-1111-1111-111111111111',
      'q1',
      { page: 2, pageSize: 500 },
    );
    const payload = JSON.parse(result.content[0].text);
    expect(payload.rows).toHaveLength(500);
    expect(payload.totalResults).toBe(600);
    expect(payload.truncated).toBe(true);
  });

  it('does not truncate when the last page exactly fills the result set', async () => {
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults.mockResolvedValue({
      status: 'ready',
      queryUuid: 'q1',
      rows: Array.from({ length: 42 }, (_, i) => makeResultRow(i)),
      columns: {},
      page: 1,
      pageSize: 500,
      totalResults: 42,
      totalPageCount: 1,
    });

    const handler = getHandler();
    const result = await handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.rows).toHaveLength(42);
    expect(payload.truncated).toBe(false);
  });

  it('times out after 30s of non-ready polls, cancels the query, and returns a clear error', async () => {
    vi.useFakeTimers();
    runMetricQuery.mockResolvedValue({ queryUuid: 'q1', fields: {}, metricQuery: {} });
    getAsyncQueryResults.mockResolvedValue({ status: 'pending', queryUuid: 'q1' });

    const handler = getHandler();
    const promise = handler({
      projectUuid: '11111111-1111-1111-1111-111111111111',
      exploreId: 'e1',
      metricQuery: {},
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('timed out');
    expect(cancelAsyncQuery).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'q1');
  });
});
