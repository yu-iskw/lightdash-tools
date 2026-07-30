/**
 * Client-side helpers for explore tool responses (summary / filter / fieldId).
 */

import type { ApiExploreResults, ApiExploresResults } from '@lightdash-tools/common';

export type ExploreSummary = {
  name: string;
  label: string;
  tags?: string[];
  databaseName?: string;
  schemaName?: string;
  errors?: unknown[];
  warnings?: unknown[];
};

export type DimensionSummary = {
  name: string;
  label?: string;
  table: string;
  type?: string;
  fieldId: string;
};

type DimensionLike = {
  name: string;
  table: string;
  label?: string;
  type?: string;
};

/** Map a summary explore to a compact MCP payload (drops fat explore fields). */
export function toExploreSummary(explore: ApiExploresResults[number]): ExploreSummary {
  const summary: ExploreSummary = {
    name: explore.name,
    label: explore.label,
  };
  if (Array.isArray(explore.tags)) {
    summary.tags = explore.tags;
  }
  if ('databaseName' in explore && typeof explore.databaseName === 'string') {
    summary.databaseName = explore.databaseName;
  }
  if ('schemaName' in explore && typeof explore.schemaName === 'string') {
    summary.schemaName = explore.schemaName;
  }
  if ('errors' in explore && Array.isArray(explore.errors)) {
    summary.errors = explore.errors;
  }
  if ('warnings' in explore && Array.isArray(explore.warnings)) {
    summary.warnings = explore.warnings;
  }
  return summary;
}

function matchesSearch(summary: ExploreSummary, query: string): boolean {
  if (summary.name.toLowerCase().includes(query)) return true;
  if (summary.label.toLowerCase().includes(query)) return true;
  if (summary.databaseName?.toLowerCase().includes(query)) return true;
  if (summary.schemaName?.toLowerCase().includes(query)) return true;
  return (summary.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
}

/**
 * Summarize, filter, and limit explores.
 * Default limit: 50 when search is set, otherwise 100.
 */
export function summarizeExplores(
  explores: ApiExploresResults,
  options?: { search?: string; limit?: number },
): ExploreSummary[] {
  const query = options?.search?.trim().toLowerCase() ?? '';
  const defaultLimit = query.length > 0 ? 50 : 100;
  const limit = Math.max(0, options?.limit ?? defaultLimit);

  const summaries: ExploreSummary[] = [];
  for (const explore of explores) {
    if (summaries.length >= limit) break;
    const summary = toExploreSummary(explore);
    if (query && !matchesSearch(summary, query)) continue;
    summaries.push(summary);
  }
  return summaries;
}

/**
 * Flatten all dimensions from an explore and return the authoritative base table name.
 * Prefer `explore.baseTable` over `explore.name` / exploreId — they can differ.
 */
export function flattenExploreDimensions(explore: ApiExploreResults): {
  baseTable: string;
  dimensions: DimensionLike[];
} {
  const dimensions: DimensionLike[] = [];
  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      dimensions.push(dim);
    }
  }
  return { baseTable: explore.baseTable, dimensions };
}

/**
 * Compact dimensions with compile_query fieldId `{table}_{name}`.
 * When `baseTable` is set, keep only rows whose `table` equals that id (joined tables dropped).
 */
export function summarizeDimensions(
  dimensions: readonly DimensionLike[],
  options?: { baseTable?: string },
): DimensionSummary[] {
  const baseTable = options?.baseTable;
  const summaries: DimensionSummary[] = [];
  for (const dim of dimensions) {
    if (baseTable !== undefined && dim.table !== baseTable) continue;
    const summary: DimensionSummary = {
      name: dim.name,
      table: dim.table,
      fieldId: `${dim.table}_${dim.name}`,
    };
    if (typeof dim.label === 'string') summary.label = dim.label;
    if (typeof dim.type === 'string') summary.type = dim.type;
    summaries.push(summary);
  }
  return summaries;
}

/** True when compiled SQL has an empty projection (SELECT … FROM with no columns). */
export function isEmptySelectSql(sql: string): boolean {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  return /SELECT FROM\b/i.test(normalized);
}

/** Extract SQL text from a compile_query API payload. */
export function extractCompiledSql(result: unknown): string | undefined {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record.query === 'string') return record.query;
    if (typeof record.compiledQuery === 'string') return record.compiledQuery;
  }
  return undefined;
}
