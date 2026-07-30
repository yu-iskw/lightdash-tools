/**
 * Client-side helpers for explore tool responses (summary / filter / fieldId).
 */

import type { ApiExploresResults } from '@lightdash-tools/common';

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

/** Compact dimensions with compile_query fieldId `{table}_{name}`. */
export function summarizeDimensions(dimensions: readonly DimensionLike[]): DimensionSummary[] {
  return dimensions.map((dim) => {
    const summary: DimensionSummary = {
      name: dim.name,
      table: dim.table,
      fieldId: `${dim.table}_${dim.name}`,
    };
    if (typeof dim.label === 'string') summary.label = dim.label;
    if (typeof dim.type === 'string') summary.type = dim.type;
    return summary;
  });
}
