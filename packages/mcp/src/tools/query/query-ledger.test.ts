import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_CONCURRENT_QUERIES_PER_SESSION,
  acquireQueryBudget,
  resetQueryBudgetsForTests,
} from '../../policy/result-limits.js';

import {
  QueryLedgerError,
  addQueryLedgerEntry,
  getOwnedQueryLedgerEntry,
  releaseOwnedQueryBudget,
  resetQueryLedgerForTests,
} from './query-ledger.js';

describe('query-ledger', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
  });

  it('stores and returns owned entries with budgetHeld', () => {
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
    });
    const entry = getOwnedQueryLedgerEntry({
      projectUuid: 'p1',
      queryUuid: 'q1',
      sessionId: 's1',
    });
    expect(entry.sourceUuid).toBe('c1');
    expect(entry.budgetHeld).toBe(true);
  });

  it('rejects other sessions', () => {
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
    });
    expect(() =>
      getOwnedQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1', sessionId: 's2' }),
    ).toThrow(QueryLedgerError);
  });

  it('rejects expired entries and releases held budget', () => {
    acquireQueryBudget('s1');
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
      ttlMs: -1,
      budgetHeld: true,
    });
    expect(() =>
      getOwnedQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1', sessionId: 's1' }),
    ).toThrow(/QUERY_EXPIRED|expired/);
    // Slot freed on expiry.
    for (let i = 0; i < MAX_CONCURRENT_QUERIES_PER_SESSION; i += 1) {
      acquireQueryBudget('s1');
    }
    expect(() => acquireQueryBudget('s1')).toThrow(/RATE_LIMITED|concurrent/);
  });

  it('releases owned budget only once', () => {
    acquireQueryBudget('s1');
    const entry = addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
      budgetHeld: true,
    });
    releaseOwnedQueryBudget(entry);
    releaseOwnedQueryBudget(entry);
    expect(entry.budgetHeld).toBe(false);
    for (let i = 0; i < MAX_CONCURRENT_QUERIES_PER_SESSION; i += 1) {
      acquireQueryBudget('s1');
    }
    expect(() => acquireQueryBudget('s1')).toThrow(/RATE_LIMITED|concurrent/);
  });
});
