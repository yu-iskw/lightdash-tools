/**
 * Shared types for elicitation-gated destructive MCP tools (ADR-0015).
 */

import type { ToolExecutionContext } from '../tools/shared.js';

export type DestructiveResourceType = 'chart' | 'dashboard';

export type ConfirmationTarget = {
  operation: 'delete';
  resourceType: DestructiveResourceType;
  resourceId: string;
  resourceName: string;
  projectUuid: string;
  location?: string;
  updatedAt?: string;
  consequences: string[];
};

export type ResourcePrecondition = {
  resourceType: DestructiveResourceType;
  resourceId: string;
  projectUuid: string;
  /** Opaque digest of material metadata (e.g. updatedAt + name + spaceUuid). */
  digest: string;
};

export type DestructiveOperationSpec<TArgs, TSnapshot> = {
  operationId: string;
  resourceType: DestructiveResourceType;
  resolveTarget: (args: TArgs, ctx: ToolExecutionContext) => Promise<TSnapshot>;
  summarizeTarget: (snapshot: TSnapshot) => ConfirmationTarget;
  getPrecondition: (snapshot: TSnapshot) => ResourcePrecondition;
  execute: (args: TArgs, snapshot: TSnapshot, ctx: ToolExecutionContext) => Promise<void>;
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

export const CONFIRM_INPUT_KEY = 'confirm_delete' as const;
