/**
 * Shared types for elicitation-gated mutation MCP tools (ADR-0015 / ADR-0017).
 */

import type { ToolExecutionContext } from '../tools/shared.js';
import type { AuditStatus } from '@lightdash-tools/common';

export type DestructiveResourceType = 'chart' | 'dashboard';

export type ConfirmationOperation = 'delete' | 'promote';

export type ConfirmationTarget = {
  operation: ConfirmationOperation;
  resourceType: DestructiveResourceType;
  resourceId: string;
  resourceName: string;
  projectUuid: string;
  location?: string;
  updatedAt?: string;
  consequences: string[];
  /** Extra human-readable lines (e.g. promoteDiff summary). */
  details?: string[];
};

export type ResourcePrecondition = {
  resourceType: DestructiveResourceType;
  resourceId: string;
  projectUuid: string;
  /** Opaque digest of material metadata (e.g. updatedAt + name + spaceUuid + promoteDiff). */
  digest: string;
};

export type DestructiveOperationSpec<TArgs, TSnapshot> = {
  operationId: string;
  resourceType: DestructiveResourceType;
  resolveTarget: (args: TArgs, ctx: ToolExecutionContext) => Promise<TSnapshot>;
  summarizeTarget: (snapshot: TSnapshot) => ConfirmationTarget;
  getPrecondition: (snapshot: TSnapshot) => ResourcePrecondition;
  /**
   * Perform the mutating API call. May return a receipt payload merged into the
   * success structured content (e.g. upstream dashboard identity after promote).
   */
  execute: (
    args: TArgs,
    snapshot: TSnapshot,
    ctx: ToolExecutionContext,
  ) => Promise<Record<string, unknown> | void>;
};

export type DestructiveRequestState = {
  operationId: string;
  resourceType: DestructiveResourceType;
  resourceId: string;
  projectUuid: string;
  preconditionDigest: string;
  sessionId: string;
  resourceName: string;
};

/** Soft-delete form input key (ADR-0015). */
export const CONFIRM_INPUT_KEY = 'confirm_delete' as const;

/** Dashboard promote form input key (ADR-0017). */
export const CONFIRM_PROMOTE_INPUT_KEY = 'confirm_promote' as const;

export type ElicitationGateLabels = {
  operation: ConfirmationOperation;
  successStatus: string;
  successAudit: AuditStatus;
  failureCode: string;
  /** Stable client-facing message (never echo upstream exception text). */
  failureMessage: string;
  failureAudit: AuditStatus;
  bindingMismatchMessage: string;
  acceptMismatchMessage: string;
  resourceChangedMessage: string;
  elicitationRequiredMessage: string;
};
