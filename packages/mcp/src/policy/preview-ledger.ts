/**
 * Session-scoped in-memory preview ledger for content-developer (ADR-0014).
 *
 * Hard gate: every SAFE_WRITE tool requires a session-owned, validated, unexpired
 * `previewId` whose `contentHash` matches the exact payload being applied. Apply
 * consumes the preview (single-use); a drifted payload or baseline is rejected as
 * `PREVIEW_STALE`.
 */

import { randomUUID } from 'node:crypto';

import { hashStableValue } from '../tools/lib/stable-stringify.js';

export const PREVIEW_RESOURCE_KINDS = ['chart', 'content-move', 'dashboard'] as const;
export type PreviewResourceKind = (typeof PREVIEW_RESOURCE_KINDS)[number];
export type PreviewStatus = 'draft' | 'validated';

/** Snapshot identity captured when the preview was issued (for update stale detection). */
export type PreviewBaseline = {
  updatedAt?: string;
  uuid?: string;
  slug?: string;
};

export type PreviewLedgerEntry = {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  /** Primary uuid/slug/'new'/joined item keys identifying the resource being previewed. */
  resourceKey: string;
  /**
   * Alternate identifiers accepted for validate/consume matching (e.g. chart UUID and
   * upsert slug). Always includes `resourceKey`.
   */
  resourceAliases: readonly string[];
  /** sha256 of the canonical JSON of `{ proposed, baseline }`. */
  contentHash: string;
  status: PreviewStatus;
  proposed: unknown;
  baseline?: PreviewBaseline;
  createdAt: string;
  expiresAt: string;
};

export class PreviewLedgerError extends Error {
  readonly code:
    | 'PREVIEW_EXPIRED'
    | 'PREVIEW_NOT_OWNED'
    | 'PREVIEW_NOT_VALIDATED'
    | 'PREVIEW_REQUIRED'
    | 'PREVIEW_STALE';

  constructor(code: PreviewLedgerError['code'], message: string) {
    super(message);
    this.name = 'PreviewLedgerError';
    this.code = code;
  }
}

/** Default preview lifetime; short enough to discourage stale multi-step drift. */
export const DEFAULT_PREVIEW_TTL_MS = 10 * 60_000;

const ledger = new Map<string, PreviewLedgerEntry>();

/** sha256 hex digest of the stable JSON form of `value`. */
export function hashPreviewContent(value: unknown): string {
  return hashStableValue(value);
}

export function uniqueResourceKeys(...keys: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const key of keys) {
    if (typeof key === 'string' && key.length > 0 && !out.includes(key)) {
      out.push(key);
    }
  }
  return out;
}

function hashPreviewBinding(proposed: unknown, baseline: PreviewBaseline | undefined): string {
  return hashPreviewContent({ proposed, baseline: baseline ?? null });
}

function resourceKeyMatches(entry: PreviewLedgerEntry, resourceKey: string): boolean {
  return entry.resourceKey === resourceKey || entry.resourceAliases.includes(resourceKey);
}

function pruneExpiredLedgerEntries(now = Date.now()): void {
  for (const [previewId, entry] of ledger) {
    if (Date.parse(entry.expiresAt) < now) {
      ledger.delete(previewId);
    }
  }
}

export function addPreviewLedgerEntry(input: {
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  /** Extra aliases (uuid/slug) accepted for validate/consume. */
  resourceAliases?: readonly string[];
  proposed: unknown;
  baseline?: PreviewBaseline;
  ttlMs?: number;
}): PreviewLedgerEntry {
  const now = Date.now();
  pruneExpiredLedgerEntries(now);
  const ttl = input.ttlMs ?? DEFAULT_PREVIEW_TTL_MS;
  const resourceAliases = uniqueResourceKeys(input.resourceKey, ...(input.resourceAliases ?? []));
  const entry: PreviewLedgerEntry = {
    previewId: randomUUID(),
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    resourceKind: input.resourceKind,
    resourceKey: input.resourceKey,
    resourceAliases,
    contentHash: hashPreviewBinding(input.proposed, input.baseline),
    status: 'draft',
    proposed: input.proposed,
    baseline: input.baseline,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  ledger.set(entry.previewId, entry);
  return entry;
}

/** Look up a preview by id, enforcing session/project ownership and expiry. */
export function getOwnedPreview(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
}): PreviewLedgerEntry {
  const entry = ledger.get(input.previewId);
  if (!entry) {
    throw new PreviewLedgerError(
      'PREVIEW_REQUIRED',
      `Preview '${input.previewId}' was not found; call the matching preview_* tool first`,
    );
  }
  if (entry.sessionId !== input.sessionId || entry.projectUuid !== input.projectUuid) {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_OWNED',
      `Preview '${input.previewId}' is not owned by this session/project`,
    );
  }
  if (Date.parse(entry.expiresAt) < Date.now()) {
    ledger.delete(input.previewId);
    throw new PreviewLedgerError('PREVIEW_EXPIRED', `Preview '${input.previewId}' has expired`);
  }
  return entry;
}

/**
 * Mark a draft preview validated after a successful validate_* (or confirm_preview) call.
 * `expected` binds validation to the resource it was actually run against — a caller cannot
 * validate/confirm preview A and have it silently unlock a write against a different resource.
 * Matching accepts `resourceKey` or any stored alias (uuid ↔ slug).
 */
export function markPreviewValidated(
  previewId: string,
  sessionId: string,
  projectUuid: string,
  expected: { resourceKind: PreviewResourceKind; resourceKey: string },
): PreviewLedgerEntry {
  const entry = getOwnedPreview({ previewId, sessionId, projectUuid });
  if (
    entry.resourceKind !== expected.resourceKind ||
    !resourceKeyMatches(entry, expected.resourceKey)
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' was created for '${entry.resourceKind}:${entry.resourceKey}', not the requested '${expected.resourceKind}:${expected.resourceKey}'`,
    );
  }
  const validated: PreviewLedgerEntry = { ...entry, status: 'validated' };
  ledger.set(previewId, validated);
  return validated;
}

/**
 * Consume a validated preview whose kind/key/contentHash match the payload being applied.
 * When the preview captured a baseline `updatedAt`, pass `currentBaseline` from a fresh
 * read so intervening edits fail closed as `PREVIEW_STALE`.
 * Deletes the entry on success (single-use); throws PreviewLedgerError otherwise.
 */
export function consumeValidatedPreview(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  proposed: unknown;
  /** Fresh resource snapshot for baseline stale detection (update flows). */
  currentBaseline?: PreviewBaseline;
}): PreviewLedgerEntry {
  const entry = getOwnedPreview({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
  });
  if (entry.status !== 'validated') {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${input.previewId}' has not been validated`,
    );
  }
  if (entry.resourceKind !== input.resourceKind || !resourceKeyMatches(entry, input.resourceKey)) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${input.previewId}' does not match the target resource ('${input.resourceKind}:${input.resourceKey}')`,
    );
  }
  if (hashPreviewBinding(input.proposed, entry.baseline) !== entry.contentHash) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${input.previewId}' content hash does not match the applied payload; re-run preview -> validate`,
    );
  }
  if (
    entry.baseline?.updatedAt != null &&
    entry.baseline.updatedAt !== '' &&
    (input.currentBaseline?.updatedAt == null ||
      input.currentBaseline.updatedAt !== entry.baseline.updatedAt)
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${input.previewId}' baseline changed (resource was updated after preview); re-run preview -> validate`,
    );
  }
  ledger.delete(input.previewId);
  return entry;
}

/** Test helper. */
export function resetPreviewLedgerForTests(): void {
  ledger.clear();
}
