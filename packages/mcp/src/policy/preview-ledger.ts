/**
 * Session-scoped preview ledger for content-developer (ADR-0014 / ADR-0016).
 *
 * Hard gate: every SAFE_WRITE tool requires a session-owned, validated, unexpired
 * `previewId` whose `contentHash` matches the exact payload being applied.
 *
 * Apply path: claim (`validated` → `applying` via CAS) → mutate → mark applied or
 * release/reconcile. Never delete-before-I/O as the sole path.
 */

import { randomUUID } from 'node:crypto';

import { LightdashApiError, NetworkError, RateLimitError } from '@lightdash-tools/client';

import { getPreviewStore, setPreviewStoreForTests } from '../store/create-preview-store.js';
import { InMemoryPreviewStore } from '../store/in-memory-preview-store.js';
import { hashStableValue } from '../tools/lib/stable-stringify.js';

export const PREVIEW_RESOURCE_KINDS = ['chart', 'content-move', 'dashboard'] as const;
export type PreviewResourceKind = (typeof PREVIEW_RESOURCE_KINDS)[number];
export type PreviewStatus = 'applying' | 'draft' | 'reconciliation_required' | 'validated';

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

/** Pluggable persistence for preview ledger entries (ADR-0016). */
export interface PreviewStore {
  get(previewId: string): Promise<PreviewLedgerEntry | undefined>;
  put(entry: PreviewLedgerEntry): Promise<void>;
  /** Atomic status transition; returns false if expected status mismatch / missing */
  compareAndSwap(
    previewId: string,
    expectedStatus: PreviewStatus,
    next: PreviewLedgerEntry,
  ): Promise<boolean>;
  /** Atomic delete when current status matches; returns false on mismatch / missing */
  compareAndDelete(previewId: string, expectedStatus: PreviewStatus): Promise<boolean>;
  delete(previewId: string): Promise<void>;
}

export class PreviewLedgerError extends Error {
  readonly code:
    | 'PREVIEW_EXPIRED'
    | 'PREVIEW_NOT_OWNED'
    | 'PREVIEW_NOT_VALIDATED'
    | 'PREVIEW_RECONCILIATION_REQUIRED'
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

/**
 * Classify upstream mutation failures for release vs reconcile.
 * HTTP 4xx (except 408/429) prove no successful mutation → release to validated.
 * Timeouts / 5xx / network / rate-limit → reconciliation_required.
 */
export function classifyMutationFailure(err: unknown): 'reconcile' | 'release' {
  if (err instanceof RateLimitError) {
    return 'reconcile';
  }
  if (err instanceof NetworkError) {
    return 'reconcile';
  }
  if (err instanceof LightdashApiError) {
    const status = err.statusCode;
    if (status === 408 || status === 429) {
      return 'reconcile';
    }
    if (status >= 400 && status < 500) {
      return 'release';
    }
    return 'reconcile';
  }
  return 'reconcile';
}

function hashPreviewBinding(proposed: unknown, baseline: PreviewBaseline | undefined): string {
  return hashPreviewContent({ proposed, baseline: baseline ?? null });
}

function resourceKeyMatches(entry: PreviewLedgerEntry, resourceKey: string): boolean {
  return entry.resourceKey === resourceKey || entry.resourceAliases.includes(resourceKey);
}

function store(): PreviewStore {
  return getPreviewStore();
}

async function assertOwnedEntry(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
}): Promise<PreviewLedgerEntry> {
  const entry = await store().get(input.previewId);
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
    await store().delete(input.previewId);
    throw new PreviewLedgerError('PREVIEW_EXPIRED', `Preview '${input.previewId}' has expired`);
  }
  if (entry.status === 'reconciliation_required') {
    throw new PreviewLedgerError(
      'PREVIEW_RECONCILIATION_REQUIRED',
      `Preview '${input.previewId}' needs reconciliation after an uncertain apply failure; inspect the resource and re-run preview -> confirm`,
    );
  }
  return entry;
}

export async function addPreviewLedgerEntry(input: {
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  /** Extra aliases (uuid/slug) accepted for validate/consume. */
  resourceAliases?: readonly string[];
  proposed: unknown;
  baseline?: PreviewBaseline;
  ttlMs?: number;
}): Promise<PreviewLedgerEntry> {
  const now = Date.now();
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
  await store().put(entry);
  return entry;
}

/** Look up a preview by id, enforcing session/project ownership and expiry. */
export async function getOwnedPreview(input: {
  previewId: string;
  sessionId: string;
  projectUuid: string;
}): Promise<PreviewLedgerEntry> {
  return assertOwnedEntry(input);
}

/**
 * Mark a draft preview validated after a successful confirm_preview call.
 * `expected` binds validation to the resource it was actually run against.
 */
export async function markPreviewValidated(
  previewId: string,
  sessionId: string,
  projectUuid: string,
  expected: { resourceKind: PreviewResourceKind; resourceKey: string },
): Promise<PreviewLedgerEntry> {
  const entry = await assertOwnedEntry({ previewId, sessionId, projectUuid });
  if (
    entry.resourceKind !== expected.resourceKind ||
    !resourceKeyMatches(entry, expected.resourceKey)
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' was created for '${entry.resourceKind}:${entry.resourceKey}', not the requested '${expected.resourceKind}:${expected.resourceKey}'`,
    );
  }
  if (entry.status !== 'draft') {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${previewId}' cannot be confirmed from status '${entry.status}'`,
    );
  }
  const validated: PreviewLedgerEntry = { ...entry, status: 'validated' };
  const swapped = await store().compareAndSwap(previewId, 'draft', validated);
  if (!swapped) {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${previewId}' could not be marked validated (status raced)`,
    );
  }
  return validated;
}

function hasNonEmpty(value: string | undefined): boolean {
  return value != null && value !== '';
}

/** Update drift or create-target appearance → PREVIEW_STALE. */
function assertBaselineStillValid(
  previewId: string,
  entry: PreviewLedgerEntry,
  currentBaseline: PreviewBaseline | undefined,
): void {
  const previewedUpdatedAt = entry.baseline?.updatedAt;
  if (hasNonEmpty(previewedUpdatedAt) && currentBaseline?.updatedAt !== previewedUpdatedAt) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' baseline changed (resource was updated after preview); re-run preview -> confirm`,
    );
  }
  if (
    entry.baseline == null &&
    (hasNonEmpty(currentBaseline?.uuid) || hasNonEmpty(currentBaseline?.updatedAt))
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' targeted a non-existent resource that now exists; re-run preview -> confirm`,
    );
  }
}

function assertClaimBindings(
  entry: PreviewLedgerEntry,
  input: {
    previewId: string;
    resourceKind: PreviewResourceKind;
    resourceKey: string;
    proposed: unknown;
    currentBaseline?: PreviewBaseline;
  },
): void {
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
      `Preview '${input.previewId}' content hash does not match the applied payload; re-run preview -> confirm`,
    );
  }
  assertBaselineStillValid(input.previewId, entry, input.currentBaseline);
}

export type ClaimPreviewForApplyInput = {
  previewId: string;
  sessionId: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  proposed: unknown;
  /** Fresh resource snapshot for baseline stale detection (update and create races). */
  currentBaseline?: PreviewBaseline;
};

/**
 * Claim a validated preview for apply (`validated` → `applying` via CAS).
 * Same kind/key/hash/baseline checks as the former consume path, but does not delete.
 */
export async function claimPreviewForApply(
  input: ClaimPreviewForApplyInput,
): Promise<PreviewLedgerEntry> {
  const entry = await assertOwnedEntry({
    previewId: input.previewId,
    sessionId: input.sessionId,
    projectUuid: input.projectUuid,
  });
  assertClaimBindings(entry, input);
  const applying: PreviewLedgerEntry = { ...entry, status: 'applying' };
  const swapped = await store().compareAndSwap(input.previewId, 'validated', applying);
  if (!swapped) {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${input.previewId}' could not be claimed for apply (already claimed or status raced)`,
    );
  }
  return applying;
}

/** Delete a claimed preview when still `applying` (single-use completion). */
export async function markPreviewApplied(previewId: string): Promise<void> {
  await store().compareAndDelete(previewId, 'applying');
}

/**
 * After a failed mutation: known no-write failures return to `validated`;
 * uncertain outcomes move to `reconciliation_required`.
 */
export async function releaseOrReconcilePreview(previewId: string, err: unknown): Promise<void> {
  const entry = await store().get(previewId);
  if (!entry || entry.status !== 'applying') {
    return;
  }
  const action = classifyMutationFailure(err);
  if (action === 'release') {
    const released: PreviewLedgerEntry = { ...entry, status: 'validated' };
    await store().compareAndSwap(previewId, 'applying', released);
    return;
  }
  const reconciling: PreviewLedgerEntry = { ...entry, status: 'reconciliation_required' };
  await store().compareAndSwap(previewId, 'applying', reconciling);
}

/**
 * Claim → run mutation → mark applied; on failure release/reconcile and rethrow.
 */
export async function withClaimedPreviewApply<T>(
  claimInput: ClaimPreviewForApplyInput,
  fn: (entry: PreviewLedgerEntry) => Promise<T>,
): Promise<T> {
  const entry = await claimPreviewForApply(claimInput);
  try {
    const result = await fn(entry);
    await markPreviewApplied(entry.previewId);
    return result;
  } catch (err) {
    await releaseOrReconcilePreview(entry.previewId, err);
    throw err;
  }
}

/** Test helper: reset to a fresh in-memory store. */
export function resetPreviewLedgerForTests(): void {
  setPreviewStoreForTests(new InMemoryPreviewStore());
}
