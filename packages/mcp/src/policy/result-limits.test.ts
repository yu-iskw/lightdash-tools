/**
 * Result-limit helpers unit tests.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  HARD_ROW_MAXIMUM,
  ResultLimitError,
  acquireQueryBudget,
  clampRowLimit,
  clampWaitMs,
  releaseQueryBudget,
  resetQueryBudgetsForTests,
} from './result-limits.js';

describe('result-limits', () => {
  afterEach(() => {
    resetQueryBudgetsForTests();
  });

  it('clamps default and rejects over hard max', () => {
    expect(clampRowLimit()).toBe(100);
    expect(clampRowLimit(50)).toBe(50);
    expect(() => clampRowLimit(HARD_ROW_MAXIMUM + 1)).toThrow(ResultLimitError);
  });

  it('clamps wait ms to 30s max', () => {
    expect(clampWaitMs()).toBe(20_000);
    expect(clampWaitMs(60_000)).toBe(30_000);
  });

  it('enforces session concurrent limit when no user key', () => {
    acquireQueryBudget('s1');
    acquireQueryBudget('s1');
    expect(() => acquireQueryBudget('s1')).toThrow(/RATE_LIMITED|concurrent/);
    releaseQueryBudget('s1');
    releaseQueryBudget('s1');
  });

  it('uses only user budgets when userKey is set (sessionless HTTP)', () => {
    for (let i = 0; i < 5; i += 1) {
      acquireQueryBudget('process:shared', 'user-a');
    }
    expect(() => acquireQueryBudget('process:shared', 'user-a')).toThrow(
      /RATE_LIMITED|User concurrent/,
    );
    // A different subject is not blocked by user-a's slots.
    acquireQueryBudget('process:shared', 'user-b');
    releaseQueryBudget('process:shared', 'user-a');
  });
});
