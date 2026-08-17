/**
 * Result limits, timeouts, and execution budgets for content-reader.
 */

export const DEFAULT_ROW_LIMIT = 2000;
export const HARD_ROW_MAXIMUM = 50000;
export const DEFAULT_WAIT_MS = 20_000;
export const MAX_WAIT_MS = 30_000;
export const MAX_CELL_CHARS = 5_000;
export const DEFAULT_QUERY_LEDGER_TTL_MS = 30 * 60_000;
export const MAX_CONCURRENT_QUERIES_PER_SESSION = 5;
export const MAX_CONCURRENT_QUERIES_PER_USER = 10;
export const QUERY_BUDGET_MAX = 500;
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

/**
 * Record a new execution against budgets.
 * When `userKey` is set (authenticated subject), only user budgets apply — session
 * ids collapse to one process key under sessionless HTTP (ADR-0019).
 * Anonymous/stdio callers use the sessionId bucket alone.
 */
export function acquireQueryBudget(sessionId: string, userKey?: string): void {
  const now = Date.now();
  const key = userKey ?? sessionId;
  const label = userKey ? 'User' : 'Session';
  const maxConcurrent = userKey
    ? MAX_CONCURRENT_QUERIES_PER_USER
    : MAX_CONCURRENT_QUERIES_PER_SESSION;
  const budgets = userKey ? userBudgets : sessionBudgets;
  const inFlight = userKey ? userInFlight : sessionInFlight;

  const bucket = budgets.get(key) ?? { timestamps: [] };
  prune(bucket, now);
  if (bucket.timestamps.length >= QUERY_BUDGET_MAX) {
    throw new ResultLimitError(
      'QUERY_BUDGET_EXCEEDED',
      `${label} query budget exceeded (${QUERY_BUDGET_MAX} / ${QUERY_BUDGET_WINDOW_MS / 60_000} min)`,
    );
  }
  const flying = inFlight.get(key) ?? 0;
  if (flying >= maxConcurrent) {
    throw new ResultLimitError(
      'RATE_LIMITED',
      `${label} concurrent query limit (${maxConcurrent}) reached`,
    );
  }
  bucket.timestamps.push(now);
  budgets.set(key, bucket);
  inFlight.set(key, flying + 1);
}

/** Release in-flight concurrency slot after query completes/fails. */
export function releaseQueryBudget(sessionId: string, userKey?: string): void {
  if (userKey) {
    const userFlying = userInFlight.get(userKey) ?? 0;
    userInFlight.set(userKey, Math.max(0, userFlying - 1));
    return;
  }
  const sessionFlying = sessionInFlight.get(sessionId) ?? 0;
  sessionInFlight.set(sessionId, Math.max(0, sessionFlying - 1));
}

/** Test helper — clear budget state. */
export function resetQueryBudgetsForTests(): void {
  sessionBudgets.clear();
  userBudgets.clear();
  sessionInFlight.clear();
  userInFlight.clear();
}
