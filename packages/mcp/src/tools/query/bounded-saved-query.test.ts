/**
 * Budget-hold behavior for async saved-query execution.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  runWithMcpClientSessionAsync,
  resolveMcpClientSessionId,
} from '../../governance/mcp-client-session.js';
import {
  MAX_CONCURRENT_QUERIES_PER_SESSION,
  acquireQueryBudget,
  resetQueryBudgetsForTests,
} from '../../policy/result-limits.js';

import { runBoundedSavedQuery } from './bounded-saved-query.js';
import { resetQueryLedgerForTests } from './query-ledger.js';

import type { LightdashClient } from '@lightdash-tools/client';

describe('runBoundedSavedQuery budget hold', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
  });

  it('keeps concurrency slot when waitForResults is false', async () => {
    const client = {
      v2: {
        query: {
          getAsyncQueryResults: vi.fn(),
        },
      },
    } as unknown as LightdashClient;

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-s1' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await runBoundedSavedQuery({
        client,
        projectUuid: 'p1',
        sourceType: 'chart',
        sourceUuid: 'c1',
        limit: 10,
        waitForResults: false,
        execute: async () => ({ queryUuid: 'q-async' }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.normalized.status).toBe('running');
      }
      // One slot still held — only MAX-1 more acquires succeed.
      for (let i = 0; i < MAX_CONCURRENT_QUERIES_PER_SESSION - 1; i += 1) {
        acquireQueryBudget(sessionId);
      }
      expect(() => acquireQueryBudget(sessionId)).toThrow(/RATE_LIMITED|concurrent/);
    });
  });

  it('releases concurrency slot when wait reaches complete', async () => {
    const client = {
      v2: {
        query: {
          getAsyncQueryResults: vi.fn().mockResolvedValue({
            queryUuid: 'q-done',
            status: 'ready',
            columns: {},
            rows: [],
            totalResults: 0,
          }),
        },
      },
    } as unknown as LightdashClient;

    const sessionId = resolveMcpClientSessionId({ sessionId: 'mcp-s2' });
    await runWithMcpClientSessionAsync(sessionId, async () => {
      const result = await runBoundedSavedQuery({
        client,
        projectUuid: 'p1',
        sourceType: 'chart',
        sourceUuid: 'c1',
        limit: 10,
        waitForResults: true,
        timeoutMs: 5_000,
        execute: async () => ({ queryUuid: 'q-done' }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.normalized.status).toBe('complete');
      }
      for (let i = 0; i < MAX_CONCURRENT_QUERIES_PER_SESSION; i += 1) {
        acquireQueryBudget(sessionId);
      }
      expect(() => acquireQueryBudget(sessionId)).toThrow(/RATE_LIMITED|concurrent/);
    });
  });
});
