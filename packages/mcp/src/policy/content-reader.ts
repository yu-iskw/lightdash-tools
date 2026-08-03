/**
 * Content-reader / bounded-query safety policy and registration helper (ADR-0012 / ADR-0020).
 */

import { READ_ONLY_DEFAULT, READ_ONLY_TRANSIENT } from '@lightdash-tools/common';

import { requireServerPersona } from '../audit/server-persona.js';
import { registerToolSafe } from '../tools/shared.js';

import type { ToolHandler, ToolOptions } from '../tools/shared.js';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

export type ReaderOperationSafety = {
  mutability: 'none' | 'transient';
  queryCapability: 'arbitrary_semantic' | 'none' | 'raw_sql' | 'saved_content' | 'underlying_data';
  resultCapability:
    'bounded_aggregate_rows' | 'bulk_export' | 'image_snapshot' | 'metadata' | 'row_level';
  usesWarehouse: boolean;
  agentExposure: 'agent' | 'client-only';
};

/** Computational read-only (warehouse run) but not idempotent — run/cancel/poll. */
export const SAVED_EXECUTION_ANNOTATIONS: ToolAnnotations = READ_ONLY_TRANSIENT;

/** Headless PNG export — read-only but not idempotent (expensive render). */
export const IMAGE_SNAPSHOT_ANNOTATIONS: ToolAnnotations = READ_ONLY_TRANSIENT;

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

/** Unsaved explore metric-query execution (ADR-0020 data-analyst). */
export const METRIC_QUERY_SAFETY: ReaderOperationSafety = {
  mutability: 'transient',
  queryCapability: 'arbitrary_semantic',
  resultCapability: 'bounded_aggregate_rows',
  usesWarehouse: true,
  agentExposure: 'agent',
};

/** Single saved-chart PNG snapshot via headless export (ADR-0012 carve-out). */
export const IMAGE_SNAPSHOT_SAFETY: ReaderOperationSafety = {
  mutability: 'none',
  queryCapability: 'saved_content',
  resultCapability: 'image_snapshot',
  usesWarehouse: true,
  agentExposure: 'agent',
};

const ALLOWED_QUERY_CAPABILITIES = new Set(['none', 'saved_content', 'arbitrary_semantic']);

/** Throws when a tool violates content-reader / bounded-query capability policy. */
export function assertContentReaderSafe(safety: ReaderOperationSafety): void {
  if (safety.mutability !== 'none' && safety.mutability !== 'transient') {
    throw new Error('Persisted mutation is forbidden');
  }
  if (!ALLOWED_QUERY_CAPABILITIES.has(safety.queryCapability)) {
    throw new Error('Only saved-content or arbitrary-semantic queries are allowed');
  }
  if (
    safety.resultCapability !== 'metadata' &&
    safety.resultCapability !== 'bounded_aggregate_rows' &&
    safety.resultCapability !== 'image_snapshot'
  ) {
    throw new Error('Row-level and bulk results are forbidden');
  }
  if (safety.agentExposure !== 'agent') {
    throw new Error('Operation is client-only');
  }
}

/**
 * Register a content-reader-family / bounded-query tool after safety asserts.
 * Fail-closed: requires bindServerPersona on the server (serving persona for envelopes/audit).
 */
export function registerContentReaderTool(
  server: McpServer,
  shortName: string,
  options: Omit<ToolOptions, 'annotations'> & {
    annotations?: ToolOptions['annotations'];
    safety: ReaderOperationSafety;
  },
  createHandler: (persona: string) => ToolHandler,
): void {
  const persona = requireServerPersona(server, shortName);
  const annotations =
    options.annotations ??
    (options.safety === SAVED_EXECUTION_SAFETY || options.safety === METRIC_QUERY_SAFETY
      ? SAVED_EXECUTION_ANNOTATIONS
      : options.safety === IMAGE_SNAPSHOT_SAFETY
        ? IMAGE_SNAPSHOT_ANNOTATIONS
        : READ_ONLY_DEFAULT);
  assertContentReaderSafe(options.safety);
  if (annotations.readOnlyHint !== true) {
    throw new Error(`content-reader requires readOnlyHint for '${shortName}'`);
  }
  registerToolSafe(server, shortName, { ...options, annotations }, createHandler(persona));
}
