import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_CONCURRENT_QUERIES_PER_SESSION,
  acquireQueryBudget,
  resetQueryBudgetsForTests,
} from '../../policy/result-limits.js';

import {
  addQueryLedgerEntry,
  findQueryLedgerEntry,
  getQueryLedgerEntry,
  releaseQueryLedgerBudget,
  resetQueryLedgerForTests,
} from './query-ledger.js';

describe('query-ledger', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
    resetQueryBudgetsForTests();
  });

  it('stores and returns entries with budgetHeld', () => {
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
    });
    const entry = getQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1' });
    expect(entry.sourceUuid).toBe('c1');
    expect(entry.budgetHeld).toBe(true);
  });

  it('returns entries regardless of requesting session', () => {
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
    });
    // Any caller can look up by projectUuid+queryUuid — no ownership check.
    const entry = getQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1' });
    expect(entry.sessionId).toBe('s1');
  });

  it('rejects missing entries as QUERY_NOT_FOUND', () => {
    expect(() => getQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'missing' })).toThrow(
      /QUERY_NOT_FOUND|not found/,
    );
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
    expect(findQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1' })).toBeUndefined();
    expect(() => getQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1' })).toThrow(
      /QUERY_NOT_FOUND|not found/,
    );
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
    releaseQueryLedgerBudget(entry);
    releaseQueryLedgerBudget(entry);
    expect(entry.budgetHeld).toBe(false);
    for (let i = 0; i < MAX_CONCURRENT_QUERIES_PER_SESSION; i += 1) {
      acquireQueryBudget('s1');
    }
    expect(() => acquireQueryBudget('s1')).toThrow(/RATE_LIMITED|concurrent/);
  });
});
