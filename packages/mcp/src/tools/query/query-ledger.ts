/**
 * In-memory query ownership ledger for content-reader (ADR-0012).
 */

import { DEFAULT_QUERY_LEDGER_TTL_MS, releaseQueryBudget } from '../../policy/result-limits.js';

export type ReaderQueryLedgerEntry = {
  queryUuid: string;
  sessionId: string;
  userUuid?: string;
  projectUuid: string;
  persona: 'content-reader';
  sourceType: 'chart' | 'dashboard_tile';
  sourceUuid: string;
  /** True while concurrency budget is held for this in-flight warehouse query. */
  budgetHeld: boolean;
  createdAt: string;
  expiresAt: string;
};

export class QueryLedgerError extends Error {
  readonly code: 'QUERY_EXPIRED' | 'QUERY_NOT_OWNED';

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
  entry: Omit<ReaderQueryLedgerEntry, 'budgetHeld' | 'createdAt' | 'expiresAt' | 'persona'> & {
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
    persona: 'content-reader',
    sourceType: entry.sourceType,
    sourceUuid: entry.sourceUuid,
    budgetHeld: entry.budgetHeld ?? true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  ledger.set(entryKey(entry.projectUuid, entry.queryUuid), full);
  return full;
}

export function getOwnedQueryLedgerEntry(input: {
  projectUuid: string;
  queryUuid: string;
  sessionId: string;
  userUuid?: string;
}): ReaderQueryLedgerEntry {
  const key = entryKey(input.projectUuid, input.queryUuid);
  const entry = ledger.get(key);
  if (!entry) {
    throw new QueryLedgerError(
      'QUERY_NOT_OWNED',
      `Query '${input.queryUuid}' is not owned by this session`,
    );
  }
  if (entry.sessionId !== input.sessionId) {
    throw new QueryLedgerError(
      'QUERY_NOT_OWNED',
      `Query '${input.queryUuid}' belongs to another session`,
    );
  }
  if (entry.userUuid && input.userUuid && entry.userUuid !== input.userUuid) {
    throw new QueryLedgerError(
      'QUERY_NOT_OWNED',
      `Query '${input.queryUuid}' belongs to another user`,
    );
  }
  if (Date.parse(entry.expiresAt) < Date.now()) {
    releaseBudgetIfHeld(entry);
    ledger.delete(key);
    throw new QueryLedgerError('QUERY_EXPIRED', `Query '${input.queryUuid}' ledger entry expired`);
  }
  return entry;
}

/** Release concurrency budget once when the warehouse query reaches a terminal state or is cancelled. */
export function releaseOwnedQueryBudget(entry: ReaderQueryLedgerEntry): void {
  releaseBudgetIfHeld(entry);
  ledger.set(entryKey(entry.projectUuid, entry.queryUuid), entry);
}

/** Test helper. */
export function resetQueryLedgerForTests(): void {
  ledger.clear();
}
