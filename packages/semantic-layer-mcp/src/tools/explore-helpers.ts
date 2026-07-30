/**
 * Client-side helpers for explore tool responses (summary / filter / fieldId).
 */

export type ExploreSummary = {
  name: string;
  label?: string;
  tags?: string[];
};

/** Map a raw explore list item to a compact summary. */
export function toExploreSummary(explore: unknown): ExploreSummary | undefined {
  if (!explore || typeof explore !== 'object') return undefined;
  const record = explore as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== 'string' || name.length === 0) return undefined;
  const summary: ExploreSummary = { name };
  if (typeof record.label === 'string') summary.label = record.label;
  if (Array.isArray(record.tags)) {
    summary.tags = record.tags.filter((t): t is string => typeof t === 'string');
  }
  return summary;
}

function matchesSearch(summary: ExploreSummary, query: string): boolean {
  if (!query) return true;
  if (summary.name.toLowerCase().includes(query)) return true;
  if (summary.label?.toLowerCase().includes(query)) return true;
  return (summary.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
}

/**
 * Summarize, filter, and limit explores.
 * Default limit: 50 when search is set, otherwise 100.
 */
export function summarizeExplores(
  explores: unknown[],
  options?: { search?: string; limit?: number },
): ExploreSummary[] {
  const search = options?.search;
  const query = search?.trim().toLowerCase() ?? '';
  const defaultLimit = query.length > 0 ? 50 : 100;
  const limit = Math.max(0, options?.limit ?? defaultLimit);

  const summaries: ExploreSummary[] = [];
  for (const explore of explores) {
    if (summaries.length >= limit) break;
    const summary = toExploreSummary(explore);
    if (!summary) continue;
    if (search !== undefined && !matchesSearch(summary, query)) continue;
    summaries.push(summary);
  }
  return summaries;
}

/** Attach compile_query fieldId `{table}_{name}` when table and name are present. */
export function withDimensionFieldIds(dimensions: unknown[]): unknown[] {
  return dimensions.map((dim) => {
    if (!dim || typeof dim !== 'object') return dim;
    const record = dim as Record<string, unknown>;
    const table = record.table;
    const name = record.name;
    if (typeof table !== 'string' || typeof name !== 'string') return dim;
    return { ...record, fieldId: `${table}_${name}` };
  });
}
