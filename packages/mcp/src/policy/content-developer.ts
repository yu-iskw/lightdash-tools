/**
 * Content-developer safety policy and registration helper (ADR-0014).
 *
 * Mutation boundary: no warehouse query execution, no row/bulk results; every
 * write is gated behind a validated preview (see `preview-ledger.ts`).
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { ProjectScopeError } from '../governance/project-scope.js';
import { codedErrorResult } from '../tools/query/reader-tool-helpers.js';
import { registerToolSafe } from '../tools/shared.js';

import { PreviewLedgerError } from './preview-ledger.js';

import type { ToolHandler, ToolOptions, TextContent } from '../tools/shared.js';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

const MUTABILITY_WRITE_NONDESTRUCTIVE = 'write-nondestructive';

export type DeveloperOperationSafety = {
  mutability: typeof MUTABILITY_WRITE_NONDESTRUCTIVE | 'none' | 'preview';
  queryCapability: 'none';
  resultCapability: 'diff' | 'metadata';
  agentExposure: 'agent';
};

/** Discovery / passthrough reads (get_project, search_content, list_spaces, ...). */
export const DISCOVERY_SAFETY: DeveloperOperationSafety = {
  mutability: 'none',
  queryCapability: 'none',
  resultCapability: 'metadata',
  agentExposure: 'agent',
};

/** preview_* — computes a diff and issues a previewId, never persists. */
export const PREVIEW_SAFETY: DeveloperOperationSafety = {
  mutability: 'preview',
  queryCapability: 'none',
  resultCapability: 'diff',
  agentExposure: 'agent',
};

/** validate_* — runs the upstream validator, returns metadata (issues), never persists. */
export const VALIDATE_SAFETY: DeveloperOperationSafety = {
  mutability: 'none',
  queryCapability: 'none',
  resultCapability: 'metadata',
  agentExposure: 'agent',
};

/** compare_*_versions — reads two historical versions and returns a diff, never persists. */
export const COMPARE_SAFETY: DeveloperOperationSafety = {
  mutability: 'none',
  queryCapability: 'none',
  resultCapability: 'diff',
  agentExposure: 'agent',
};

/** SAFE_WRITE apply tools gated by a validated previewId. */
export const WRITE_SAFETY: DeveloperOperationSafety = {
  mutability: MUTABILITY_WRITE_NONDESTRUCTIVE,
  queryCapability: 'none',
  resultCapability: 'metadata',
  agentExposure: 'agent',
};

/** Throws when a tool violates content-developer capability policy. */
export function assertContentDeveloperSafe(safety: DeveloperOperationSafety): void {
  if (
    safety.mutability !== 'none' &&
    safety.mutability !== 'preview' &&
    safety.mutability !== MUTABILITY_WRITE_NONDESTRUCTIVE
  ) {
    throw new Error('content-developer forbids destructive or unbounded mutability');
  }
  if (safety.queryCapability !== 'none') {
    throw new Error('content-developer forbids warehouse query execution');
  }
  if (safety.resultCapability !== 'metadata' && safety.resultCapability !== 'diff') {
    throw new Error('content-developer forbids row-level and bulk results');
  }
  if (safety.agentExposure !== 'agent') {
    throw new Error('Operation is client-only');
  }
}

/** Register a content-developer tool after safety asserts. */
export function registerContentDeveloperTool(
  server: McpServer,
  shortName: string,
  options: Omit<ToolOptions, 'annotations'> & {
    annotations?: ToolOptions['annotations'];
    safety: DeveloperOperationSafety;
  },
  handler: ToolHandler,
): void {
  assertContentDeveloperSafe(options.safety);
  const annotations: ToolAnnotations = options.annotations ?? READ_ONLY_DEFAULT;
  if (
    (options.safety.mutability === 'none' || options.safety.mutability === 'preview') &&
    annotations.readOnlyHint !== true
  ) {
    throw new Error(`content-developer requires readOnlyHint for '${shortName}'`);
  }
  if (
    options.safety.mutability === MUTABILITY_WRITE_NONDESTRUCTIVE &&
    annotations.readOnlyHint === true
  ) {
    throw new Error(`content-developer write tool '${shortName}' must not set readOnlyHint`);
  }
  registerToolSafe(server, shortName, { ...options, annotations }, handler);
}

/** Map ProjectScopeError / PreviewLedgerError to a coded tool error result; rethrow anything else. */
export function developerErrorResult(err: unknown): TextContent {
  if (err instanceof ProjectScopeError) {
    return codedErrorResult(err.code, err.message);
  }
  if (err instanceof PreviewLedgerError) {
    return codedErrorResult(err.code, err.message);
  }
  throw err;
}
