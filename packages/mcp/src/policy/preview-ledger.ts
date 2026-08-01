/**
 * Session-scoped in-memory preview ledger for content-developer (ADR-0014).
 *
 * Hard gate: every SAFE_WRITE tool requires a session-owned, validated, unexpired
 * `previewId` whose `contentHash` matches the exact payload being applied. Apply
 * consumes the preview (single-use); a drifted payload is rejected as `PREVIEW_STALE`.
 */

import { createHash, randomUUID } from 'node:crypto';

import { stableStringify } from '../tools/project/developer-helpers.js';

export type PreviewResourceKind = 'chart' | 'content-move' | 'dashboard' | 'space';
export type PreviewStatus = 'draft' | 'validated';

export type PreviewLedgerEntry = {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  /** uuid/slug/'new'/joined item keys identifying the resource being previewed. */
  resourceKey: string;
  /** sha256 of the canonical (sorted-key) JSON of `proposed`. */
  contentHash: string;
  status: PreviewStatus;
  proposed: unknown;
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
  return createHash('sha256').update(stableStringify(value)).digest('hex');
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
  proposed: unknown;
  ttlMs?: number;
}): PreviewLedgerEntry {
  const now = Date.now();
  pruneExpiredLedgerEntries(now);
  const ttl = input.ttlMs ?? DEFAULT_PREVIEW_TTL_MS;
  const entry: PreviewLedgerEntry = {
    previewId: randomUUID(),
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
    resourceKind: input.resourceKind,
    resourceKey: input.resourceKey,
    contentHash: hashPreviewContent(input.proposed),
    status: 'draft',
    proposed: input.proposed,
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
 */
export function markPreviewValidated(
  previewId: string,
  sessionId: string,
  projectUuid: string,
  expected: { resourceKind: PreviewResourceKind; resourceKey: string },
): PreviewLedgerEntry {
  const entry = getOwnedPreview({ previewId, sessionId, projectUuid });
  if (entry.resourceKind !== expected.resourceKind || entry.resourceKey !== expected.resourceKey) {
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
 * Deletes the entry on success (single-use); throws PreviewLedgerError otherwise.
 */
export function consumeValidatedPreview(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  proposed: unknown;
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
  if (entry.resourceKind !== input.resourceKind || entry.resourceKey !== input.resourceKey) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${input.previewId}' does not match the target resource ('${input.resourceKind}:${input.resourceKey}')`,
    );
  }
  if (hashPreviewContent(input.proposed) !== entry.contentHash) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${input.previewId}' content hash does not match the applied payload; re-run preview -> validate`,
    );
  }
  ledger.delete(input.previewId);
  return entry;
}

/** Test helper. */
export function resetPreviewLedgerForTests(): void {
  ledger.clear();
}
