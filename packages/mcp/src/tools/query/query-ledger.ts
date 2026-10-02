/**
 * In-memory query handle ledger for content-reader (ADR-0012 / ADR-0019).
 * Keyed by projectUuid+queryUuid; sessionId retained only for per-process budget release.
 */

import { DEFAULT_QUERY_LEDGER_TTL_MS, releaseQueryBudget } from '../../policy/result-limits.js';

export type QueryLedgerSourceType = 'chart' | 'dashboard_tile' | 'metric_query';

export type ReaderQueryLedgerEntry = {
  queryUuid: string;
  sessionId: string;
  userUuid?: string;
  projectUuid: string;
  sourceType: QueryLedgerSourceType;
  sourceUuid: string;
  /** True while concurrency budget is held for this in-flight warehouse query. */
  budgetHeld: boolean;
  createdAt: string;
  expiresAt: string;
};

export class QueryLedgerError extends Error {
  readonly code: 'QUERY_NOT_FOUND';

  constructor(code: QueryLedgerError['code'], message: string) {
    super(message);
    this.name = 'QueryLedgerError';
    this.code = code;
  }
}

const ledger = new Map<string, ReaderQueryLedgerEntry>();

function entryKey(projectUuid: string, queryUuid: string): string {
  return `${projectUuid}:${queryUuid}`;
}

function releaseBudgetIfHeld(entry: ReaderQueryLedgerEntry): void {
  if (!entry.budgetHeld) {
    return;
  }
  releaseQueryBudget(entry.sessionId, entry.userUuid);
  entry.budgetHeld = false;
}

function pruneExpiredLedgerEntries(now = Date.now()): void {
  for (const [key, existing] of ledger) {
    if (Date.parse(existing.expiresAt) < now) {
      releaseBudgetIfHeld(existing);
      ledger.delete(key);
    }
  }
}

export function addQueryLedgerEntry(
  entry: Omit<ReaderQueryLedgerEntry, 'budgetHeld' | 'createdAt' | 'expiresAt'> & {
    ttlMs?: number;
    budgetHeld?: boolean;
  },
): ReaderQueryLedgerEntry {
  const now = Date.now();
  pruneExpiredLedgerEntries(now);
  const ttl = entry.ttlMs ?? DEFAULT_QUERY_LEDGER_TTL_MS;
  const full: ReaderQueryLedgerEntry = {
    queryUuid: entry.queryUuid,
    sessionId: entry.sessionId,
    userUuid: entry.userUuid,
    projectUuid: entry.projectUuid,
    sourceType: entry.sourceType,
    sourceUuid: entry.sourceUuid,
    budgetHeld: entry.budgetHeld ?? true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  ledger.set(entryKey(entry.projectUuid, entry.queryUuid), full);
  return full;
}

/** Look up a ledger entry by projectUuid+queryUuid (no session ownership check). */
export function getQueryLedgerEntry(input: {
  projectUuid: string;
  queryUuid: string;
}): ReaderQueryLedgerEntry {
  const entry = findQueryLedgerEntry(input);
  if (!entry) {
    throw new QueryLedgerError(
      'QUERY_NOT_FOUND',
      `Query '${input.queryUuid}' not found or already expired`,
    );
  }
  return entry;
}

/**
 * Best-effort ledger lookup for budget release. Missing/expired entries return undefined
 * so get/cancel can still use the Lightdash queryUuid handle across replicas (ADR-0019).
 */
export function findQueryLedgerEntry(input: {
  projectUuid: string;
  queryUuid: string;
}): ReaderQueryLedgerEntry | undefined {
  const key = entryKey(input.projectUuid, input.queryUuid);
  const entry = ledger.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.parse(entry.expiresAt) < Date.now()) {
    releaseBudgetIfHeld(entry);
    ledger.delete(key);
    return undefined;
  }
  return entry;
}

/** Release concurrency budget once when the warehouse query reaches a terminal state or is cancelled. */
export function releaseQueryLedgerBudget(entry: ReaderQueryLedgerEntry): void {
  releaseBudgetIfHeld(entry);
}

/** Test helper. */
export function resetQueryLedgerForTests(): void {
  ledger.clear();
}
