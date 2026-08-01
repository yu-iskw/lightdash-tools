/**
 * Content-reader safety policy and registration helper (ADR-0012).
 */

import { READ_ONLY_DEFAULT, READ_ONLY_TRANSIENT } from '@lightdash-tools/common';

import { registerToolSafe } from '../tools/shared.js';

import type { ToolHandler, ToolOptions } from '../tools/shared.js';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

export type ReaderOperationSafety = {
  mutability: 'none' | 'transient';
  queryCapability: 'arbitrary_semantic' | 'none' | 'raw_sql' | 'saved_content' | 'underlying_data';
  resultCapability: 'bounded_aggregate_rows' | 'bulk_export' | 'metadata' | 'row_level';
  usesWarehouse: boolean;
  agentExposure: 'agent' | 'client-only';
};

/** Computational read-only (warehouse run) but not idempotent — run/cancel/poll. */
export const SAVED_EXECUTION_ANNOTATIONS: ToolAnnotations = READ_ONLY_TRANSIENT;

export const METADATA_SAFETY: ReaderOperationSafety = {
  mutability: 'none',
  queryCapability: 'none',
  resultCapability: 'metadata',
  usesWarehouse: false,
  agentExposure: 'agent',
};

export const SAVED_EXECUTION_SAFETY: ReaderOperationSafety = {
  mutability: 'transient',
  queryCapability: 'saved_content',
  resultCapability: 'bounded_aggregate_rows',
  usesWarehouse: true,
  agentExposure: 'agent',
};

/** Throws when a tool violates content-reader capability policy. */
export function assertContentReaderSafe(safety: ReaderOperationSafety): void {
  if (safety.mutability !== 'none' && safety.mutability !== 'transient') {
    throw new Error('Persisted mutation is forbidden');
  }
  if (safety.queryCapability !== 'none' && safety.queryCapability !== 'saved_content') {
    throw new Error('Only saved-content queries are allowed');
  }
  if (
    safety.resultCapability !== 'metadata' &&
    safety.resultCapability !== 'bounded_aggregate_rows'
  ) {
    throw new Error('Row-level and bulk results are forbidden');
  }
  if (safety.agentExposure !== 'agent') {
    throw new Error('Operation is client-only');
  }
}

/** Register a content-reader tool after safety asserts. */
export function registerContentReaderTool(
  server: McpServer,
  shortName: string,
  options: Omit<ToolOptions, 'annotations'> & {
    annotations?: ToolOptions['annotations'];
    safety: ReaderOperationSafety;
  },
  handler: ToolHandler,
): void {
  const annotations =
    options.annotations ??
    (options.safety === SAVED_EXECUTION_SAFETY ? SAVED_EXECUTION_ANNOTATIONS : READ_ONLY_DEFAULT);
  assertContentReaderSafe(options.safety);
  if (annotations.readOnlyHint !== true) {
    throw new Error(`content-reader requires readOnlyHint for '${shortName}'`);
  }
  registerToolSafe(server, shortName, { ...options, annotations }, handler);
}
