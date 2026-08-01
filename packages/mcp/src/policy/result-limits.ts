/**
 * Result limits, timeouts, and execution budgets for content-reader.
 */

export const DEFAULT_ROW_LIMIT = 100;
export const HARD_ROW_MAXIMUM = 1000;
export const DEFAULT_WAIT_MS = 20_000;
export const MAX_WAIT_MS = 30_000;
export const MAX_CELL_CHARS = 2_000;
export const DEFAULT_QUERY_LEDGER_TTL_MS = 30 * 60_000;
export const MAX_CONCURRENT_QUERIES_PER_SESSION = 2;
export const MAX_CONCURRENT_QUERIES_PER_USER = 5;
export const QUERY_BUDGET_MAX = 20;
export const QUERY_BUDGET_WINDOW_MS = 10 * 60_000;

export class ResultLimitError extends Error {
  readonly code: 'QUERY_BUDGET_EXCEEDED' | 'RATE_LIMITED' | 'ROW_LIMIT_EXCEEDED';

  constructor(code: ResultLimitError['code'], message: string) {
    super(message);
    this.name = 'ResultLimitError';
    this.code = code;
  }
}

/** Clamp requested limit to [1, HARD_ROW_MAXIMUM]; default DEFAULT_ROW_LIMIT. */
export function clampRowLimit(requested?: number | null): number {
  if (requested === undefined || requested === null) {
    return DEFAULT_ROW_LIMIT;
  }
  if (!Number.isFinite(requested) || requested < 1) {
    throw new ResultLimitError('ROW_LIMIT_EXCEEDED', 'limit must be a positive integer');
  }
  if (requested > HARD_ROW_MAXIMUM) {
    throw new ResultLimitError(
      'ROW_LIMIT_EXCEEDED',
      `limit ${requested} exceeds hard maximum ${HARD_ROW_MAXIMUM}`,
    );
  }
  return Math.floor(requested);
}

/** Clamp tool wait; default 20s, hard max 30s. */
export function clampWaitMs(requested?: number | null): number {
  if (requested === undefined || requested === null) {
    return DEFAULT_WAIT_MS;
  }
  if (!Number.isFinite(requested) || requested < 0) {
    return DEFAULT_WAIT_MS;
  }
  return Math.min(Math.floor(requested), MAX_WAIT_MS);
}

type BudgetBucket = { timestamps: number[] };

const sessionBudgets = new Map<string, BudgetBucket>();
const userBudgets = new Map<string, BudgetBucket>();
const sessionInFlight = new Map<string, number>();
const userInFlight = new Map<string, number>();

function prune(bucket: BudgetBucket, now: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < QUERY_BUDGET_WINDOW_MS);
}

/** Record a new execution against session/user budgets; throws when exceeded. */
export function acquireQueryBudget(sessionId: string, userKey?: string): void {
  const now = Date.now();
  const sessionBucket = sessionBudgets.get(sessionId) ?? { timestamps: [] };
  prune(sessionBucket, now);
  if (sessionBucket.timestamps.length >= QUERY_BUDGET_MAX) {
    throw new ResultLimitError(
      'QUERY_BUDGET_EXCEEDED',
      `Session query budget exceeded (${QUERY_BUDGET_MAX} / ${QUERY_BUDGET_WINDOW_MS / 60_000} min)`,
    );
  }
  const sessionFlying = sessionInFlight.get(sessionId) ?? 0;
  if (sessionFlying >= MAX_CONCURRENT_QUERIES_PER_SESSION) {
    throw new ResultLimitError(
      'RATE_LIMITED',
      `Session concurrent query limit (${MAX_CONCURRENT_QUERIES_PER_SESSION}) reached`,
    );
  }
  if (userKey) {
    const userBucket = userBudgets.get(userKey) ?? { timestamps: [] };
    prune(userBucket, now);
    if (userBucket.timestamps.length >= QUERY_BUDGET_MAX) {
      throw new ResultLimitError(
        'QUERY_BUDGET_EXCEEDED',
        `User query budget exceeded (${QUERY_BUDGET_MAX} / ${QUERY_BUDGET_WINDOW_MS / 60_000} min)`,
      );
    }
    const userFlying = userInFlight.get(userKey) ?? 0;
    if (userFlying >= MAX_CONCURRENT_QUERIES_PER_USER) {
      throw new ResultLimitError(
        'RATE_LIMITED',
        `User concurrent query limit (${MAX_CONCURRENT_QUERIES_PER_USER}) reached`,
      );
    }
    userBucket.timestamps.push(now);
    userBudgets.set(userKey, userBucket);
    userInFlight.set(userKey, userFlying + 1);
  }
  sessionBucket.timestamps.push(now);
  sessionBudgets.set(sessionId, sessionBucket);
  sessionInFlight.set(sessionId, sessionFlying + 1);
}

/** Release in-flight concurrency slot after query completes/fails. */
export function releaseQueryBudget(sessionId: string, userKey?: string): void {
  const sessionFlying = sessionInFlight.get(sessionId) ?? 0;
  sessionInFlight.set(sessionId, Math.max(0, sessionFlying - 1));
  if (userKey) {
    const userFlying = userInFlight.get(userKey) ?? 0;
    userInFlight.set(userKey, Math.max(0, userFlying - 1));
  }
}

/** Test helper — clear budget state. */
export function resetQueryBudgetsForTests(): void {
  sessionBudgets.clear();
  userBudgets.clear();
  sessionInFlight.clear();
  userInFlight.clear();
}
