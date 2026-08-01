import { describe, expect, it, beforeEach } from 'vitest';

import {
  QueryLedgerError,
  addQueryLedgerEntry,
  getOwnedQueryLedgerEntry,
  resetQueryLedgerForTests,
} from './query-ledger.js';

describe('query-ledger', () => {
  beforeEach(() => {
    resetQueryLedgerForTests();
  });

  it('stores and returns owned entries', () => {
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

  it('rejects expired entries', () => {
    addQueryLedgerEntry({
      queryUuid: 'q1',
      sessionId: 's1',
      projectUuid: 'p1',
      sourceType: 'chart',
      sourceUuid: 'c1',
      ttlMs: -1,
    });
    expect(() =>
      getOwnedQueryLedgerEntry({ projectUuid: 'p1', queryUuid: 'q1', sessionId: 's1' }),
    ).toThrow(/QUERY_EXPIRED|expired/);
  });
});
