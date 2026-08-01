import { describe, expect, it, vi } from 'vitest';

import { waitForAsyncQueryResults } from './wait-for-async.js';

import type { LightdashClient } from '@lightdash-tools/client';

function stubClient(
  getAsyncQueryResults: (
    projectUuid: string,
    queryUuid: string,
    params?: unknown,
  ) => Promise<unknown>,
): LightdashClient {
  return {
    v2: {
      query: { getAsyncQueryResults },
    },
  } as unknown as LightdashClient;
}

describe('waitForAsyncQueryResults', () => {
  it('waitMs <= 0 does a single full-page fetch and never fabricates QUERY_TIMEOUT', async () => {
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q1',
      status: 'pending',
    });
    const client = stubClient(getAsyncQueryResults);

    const result = await waitForAsyncQueryResults(client, 'proj', 'q1', {
      waitMs: 0,
      maxRows: 50,
    });

    expect(getAsyncQueryResults).toHaveBeenCalledTimes(1);
    expect(getAsyncQueryResults).toHaveBeenCalledWith('proj', 'q1', {
      page: 1,
      pageSize: 50,
    });
    expect(result.status).toBe('running');
    expect(result.warnings).not.toContain('QUERY_TIMEOUT');
  });

  it('waitMs > 0 still appends QUERY_TIMEOUT when the deadline elapses while running', async () => {
    const getAsyncQueryResults = vi.fn().mockResolvedValue({
      queryUuid: 'q1',
      status: 'executing',
    });
    const client = stubClient(getAsyncQueryResults);

    const result = await waitForAsyncQueryResults(client, 'proj', 'q1', {
      waitMs: 1,
      maxRows: 10,
    });

    expect(getAsyncQueryResults.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings).toContain('QUERY_TIMEOUT');
    expect(result.status).toBe('running');
  });
});
