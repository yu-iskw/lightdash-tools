/**
 * HMAC-signed preview tokens for content-developer (ADR-0014 / ADR-0019).
 *
 * Hard gate: every SAFE_WRITE requires a validated, unexpired `previewToken` whose
 * `contentHash` matches `{ proposed, baseline }`. Tokens are client-carried (no server
 * ledger). confirm_preview mints a validated token; apply verifies + re-sends proposed.
 */

import { randomUUID } from 'node:crypto';

import { createRequestStateCodec } from '@modelcontextprotocol/server';

import { PREVIEW_TOKEN_KEY_PURPOSE, resolveRequestStateKey } from '../auth/request-state-key.js';
import { hashStableValue } from '../tools/lib/stable-stringify.js';

import type { RequestStateCodec, ServerContext } from '@modelcontextprotocol/server';

export const PREVIEW_RESOURCE_KINDS = ['chart', 'content-move', 'dashboard'] as const;
export type PreviewResourceKind = (typeof PREVIEW_RESOURCE_KINDS)[number];
export type PreviewStatus = 'draft' | 'validated';

/** Snapshot identity captured when the preview was issued (for update stale detection). */
export type PreviewBaseline = {
  updatedAt?: string;
  uuid?: string;
  slug?: string;
};

/** Compact claims embedded in the HMAC-signed previewToken (no proposed body). */
export type PreviewTokenClaims = {
  previewId: string;
  subject: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  resourceAliases: readonly string[];
  contentHash: string;
  status: PreviewStatus;
  baseline?: PreviewBaseline;
  createdAt: string;
  expiresAt: string;
};

export class PreviewLedgerError extends Error {
  readonly code:
    'PREVIEW_NOT_OWNED' | 'PREVIEW_NOT_VALIDATED' | 'PREVIEW_REQUIRED' | 'PREVIEW_STALE';

  constructor(code: PreviewLedgerError['code'], message: string) {
    super(message);
    this.name = 'PreviewLedgerError';
    this.code = code;
  }
}

/** Default preview lifetime; short enough to discourage stale multi-step drift. */
export const DEFAULT_PREVIEW_TTL_MS = 10 * 60_000;
const TTL_SECONDS = DEFAULT_PREVIEW_TTL_MS / 1000;

/** Minimal ServerContext for unit tests that mint/verify without a live MCP request. */
export const EMPTY_SERVER_CONTEXT = { mcpReq: {} } as ServerContext;

let codec: RequestStateCodec<PreviewTokenClaims> | undefined;

function getPreviewTokenCodec(): RequestStateCodec<PreviewTokenClaims> {
  if (!codec) {
    codec = createRequestStateCodec<PreviewTokenClaims>({
      key: resolveRequestStateKey(PREVIEW_TOKEN_KEY_PURPOSE),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return codec;
}

/** Reset codec (tests only). */
export function resetPreviewLedgerForTests(): void {
  codec = undefined;
}

/** sha256 hex digest of the stable JSON form of `value` (preview binding hash). */
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
  return hashStableValue({ proposed, baseline: baseline ?? null });
}

function resourceKeyMatches(claims: PreviewTokenClaims, resourceKey: string): boolean {
  return claims.resourceKey === resourceKey || claims.resourceAliases.includes(resourceKey);
}

/** Update drift or create-target appearance → PREVIEW_STALE. */
function assertBaselineStillValid(
  previewId: string,
  claims: PreviewTokenClaims,
  currentBaseline: PreviewBaseline | undefined,
): void {
  const previewedUpdatedAt = claims.baseline?.updatedAt;
  if (
    previewedUpdatedAt != null &&
    previewedUpdatedAt !== '' &&
    currentBaseline?.updatedAt !== previewedUpdatedAt
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' baseline changed (resource was updated after preview); re-run preview -> confirm`,
    );
  }
  if (
    claims.baseline == null &&
    ((currentBaseline?.uuid != null && currentBaseline.uuid !== '') ||
      (currentBaseline?.updatedAt != null && currentBaseline.updatedAt !== ''))
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${previewId}' targeted a non-existent resource that now exists; re-run preview -> confirm`,
    );
  }
}

function resolveServerContext(serverContext: ServerContext | undefined): ServerContext {
  return serverContext ?? EMPTY_SERVER_CONTEXT;
}

function assertResourceBinding(
  claims: PreviewTokenClaims,
  expected: { resourceKind: PreviewResourceKind; resourceKey: string },
): void {
  if (
    claims.resourceKind !== expected.resourceKind ||
    !resourceKeyMatches(claims, expected.resourceKey)
  ) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${claims.previewId}' was created for '${claims.resourceKind}:${claims.resourceKey}', not the requested '${expected.resourceKind}:${expected.resourceKey}'`,
    );
  }
}

async function mintClaims(
  claims: PreviewTokenClaims,
  serverContext: ServerContext | undefined,
): Promise<string> {
  return getPreviewTokenCodec().mint(claims, resolveServerContext(serverContext));
}

async function verifyClaims(
  previewToken: string,
  serverContext: ServerContext | undefined,
): Promise<PreviewTokenClaims> {
  if (previewToken.length === 0) {
    throw new PreviewLedgerError(
      'PREVIEW_REQUIRED',
      'previewToken is required; call the matching preview_* tool first',
    );
  }
  try {
    const claims = await getPreviewTokenCodec().verify(
      previewToken,
      resolveServerContext(serverContext),
    );
    if (Date.parse(claims.expiresAt) < Date.now()) {
      throw new PreviewLedgerError(
        'PREVIEW_REQUIRED',
        'previewToken is invalid or expired; call the matching preview_* tool first',
      );
    }
    return claims;
  } catch (err) {
    if (err instanceof PreviewLedgerError) {
      throw err;
    }
    throw new PreviewLedgerError(
      'PREVIEW_REQUIRED',
      'previewToken is invalid or expired; call the matching preview_* tool first',
    );
  }
}

function assertSubjectAndProject(
  claims: PreviewTokenClaims,
  subject: string,
  projectUuid: string,
): void {
  if (claims.subject !== subject || claims.projectUuid !== projectUuid) {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_OWNED',
      `Preview '${claims.previewId}' is not owned by this subject/project`,
    );
  }
}

/** Mint a draft previewToken (opaque HMAC blob). Does not store proposed on the server. */
export async function mintDraftPreviewToken(input: {
  subject: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  resourceAliases?: readonly string[];
  proposed: unknown;
  baseline?: PreviewBaseline;
  serverContext?: ServerContext;
}): Promise<{ previewToken: string; claims: PreviewTokenClaims }> {
  const now = Date.now();
  const resourceAliases = uniqueResourceKeys(input.resourceKey, ...(input.resourceAliases ?? []));
  const claims: PreviewTokenClaims = {
    previewId: randomUUID(),
    subject: input.subject,
    projectUuid: input.projectUuid,
    resourceKind: input.resourceKind,
    resourceKey: input.resourceKey,
    resourceAliases,
    contentHash: hashPreviewBinding(input.proposed, input.baseline),
    status: 'draft',
    baseline: input.baseline,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_PREVIEW_TTL_MS).toISOString(),
  };
  const previewToken = await mintClaims(claims, input.serverContext);
  return { previewToken, claims };
}

/** Confirm a draft token: verify bindings and mint a validated token (no server write). */
export async function confirmPreviewToken(input: {
  previewToken: string;
  subject: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  serverContext?: ServerContext;
}): Promise<{ previewToken: string; claims: PreviewTokenClaims }> {
  const claims = await verifyClaims(input.previewToken, input.serverContext);
  assertSubjectAndProject(claims, input.subject, input.projectUuid);
  assertResourceBinding(claims, input);
  if (claims.status !== 'draft') {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${claims.previewId}' cannot be confirmed from status '${claims.status}'`,
    );
  }
  const now = Date.now();
  const validated: PreviewTokenClaims = {
    ...claims,
    status: 'validated',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_PREVIEW_TTL_MS).toISOString(),
  };
  const previewToken = await mintClaims(validated, input.serverContext);
  return { previewToken, claims: validated };
}

export type ApplyPreviewTokenInput = {
  previewToken: string;
  subject: string;
  projectUuid: string;
  resourceKind: PreviewResourceKind;
  resourceKey: string;
  proposed: unknown;
  currentBaseline?: PreviewBaseline;
  serverContext?: ServerContext;
};

/** Verify validated token then run mutation (ADR-0019: no server-side claim/release). */
export async function withValidatedPreviewApply<T>(
  input: ApplyPreviewTokenInput,
  fn: (claims: PreviewTokenClaims) => Promise<T>,
): Promise<T> {
  const claims = await verifyClaims(input.previewToken, input.serverContext);
  assertSubjectAndProject(claims, input.subject, input.projectUuid);
  if (claims.status !== 'validated') {
    throw new PreviewLedgerError(
      'PREVIEW_NOT_VALIDATED',
      `Preview '${claims.previewId}' has not been validated`,
    );
  }
  assertResourceBinding(claims, input);
  if (hashPreviewBinding(input.proposed, claims.baseline) !== claims.contentHash) {
    throw new PreviewLedgerError(
      'PREVIEW_STALE',
      `Preview '${claims.previewId}' content hash does not match the applied payload; re-run preview -> confirm`,
    );
  }
  assertBaselineStillValid(claims.previewId, claims, input.currentBaseline);
  return fn(claims);
}
