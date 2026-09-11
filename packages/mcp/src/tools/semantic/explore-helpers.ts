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
  const dimensions = Object.values(explore.tables).flatMap((table) =>
    Object.values(table.dimensions),
  );
  return { baseTable: explore.baseTable, dimensions };
}

/**
 * Compile-ready fieldId matching Lightdash `getItemId`
 * (`${table}_${name}` with every `.` in `name` → `__`; see lightdash#6320).
 */
export function toFieldId(table: string, name: string): string {
  return `${table}_${name.split('.').join('__')}`;
}

/**
 * Compact dimensions with compile_query fieldId via {@link toFieldId}.
 * When `baseTable` is set, keep only rows whose `table` equals that id (joined tables dropped).
 * `name` stays the API value (may contain dots); `fieldId` is compile-ready.
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
      fieldId: toFieldId(dim.table, dim.name),
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

/** Body of the first Lightdash ERROR block comment (`ERROR:…`), if present. */
export function extractCompileSqlErrorComment(sql: string): string | undefined {
  const match = /\/\*\s*(ERROR:[\s\S]*?)\*\//i.exec(sql);
  const body = match?.[1]?.trim();
  return body && body.length > 0 ? body : undefined;
}

/** True when Lightdash embedded a compile failure comment (e.g. unknown filter fieldId). */
export function hasCompileSqlErrorComment(sql: string): boolean {
  return extractCompileSqlErrorComment(sql) !== undefined;
}

/**
 * Collect SELECT aliases from compiled SQL (`AS \`alias\``, `AS "alias"`, or `AS alias`).
 * Heuristic only (not a SQL parser): stops at the first FROM; CAST(... AS type) may
 * contribute type names as extras. Prefer {@link findMissingFieldIds}, which skips the
 * check when no aliases are found (inconclusive dialect/CTE parse).
 */
export function extractSelectAliases(sql: string): string[] {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const selectMatch = /\bSELECT\b([\s\S]*?)(?:\bFROM\b|$)/i.exec(normalized);
  if (!selectMatch?.[1]) return [];
  const selectList = selectMatch[1];
  const aliases: string[] = [];
  const quotedAs = /\bAS\s+(?:`([^`]+)`|"([^"]+)")/gi;
  const plainAs = /\bAS\s+([A-Za-z_][\w$]*)/gi;
  for (const match of selectList.matchAll(quotedAs)) {
    const alias = match[1] ?? match[2];
    if (alias) aliases.push(alias);
  }
  for (const match of selectList.matchAll(plainAs)) {
    if (match[1]) aliases.push(match[1]);
  }
  return aliases;
}

/**
 * Requested fieldIds that do not appear as SELECT aliases in compiled SQL.
 * Returns [] when the alias extract is empty (inconclusive — e.g. CTE-truncated SELECT
 * or an unsupported quote style) so compile_query does not false-fail closed.
 */
export function findMissingFieldIds(requested: readonly string[], sql: string): string[] {
  if (requested.length === 0) return [];
  const aliases = extractSelectAliases(sql);
  if (aliases.length === 0) return [];
  const aliasSet = new Set(aliases);
  return requested.filter((id) => !aliasSet.has(id));
}

/** Collect string fieldIds from metricQuery.dimensions and metricQuery.metrics. */
export function collectRequestedFieldIds(metricQuery: Record<string, unknown>): string[] {
  const requested: string[] = [];
  const batches = [metricQuery.dimensions, metricQuery.metrics];
  for (const value of batches) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === 'string' && entry.length > 0) requested.push(entry);
    }
  }
  return requested;
}

const COMPILED_SQL_FIELD_ID_HINT =
  'Copy fieldIds from list_dimensions (STRUCT name dots → `__`; ARRAY via join tables with ' +
  'baseTableOnly=false) and explore-local metrics; re-compile.';

/** Diagnose post-compile SQL for agents. Returns error text, or undefined when OK. */
export function diagnoseCompiledSql(
  sql: string | undefined,
  requestedFieldIds: readonly string[],
): string | undefined {
  if (!sql) return undefined;
  if (isEmptySelectSql(sql)) {
    return (
      'Error: compile_query produced an empty SELECT (no columns). ' +
      'Use fieldId values like `{table}_{name}` from list_dimensions (base table; nested dots → `__`), ' +
      'not short field names. Re-compile after fixing metricQuery.'
    );
  }
  const errorComment = extractCompileSqlErrorComment(sql);
  if (errorComment) {
    return (
      'Error: compile_query SQL contains a Lightdash `/* ERROR:` comment ' +
      `(often an unknown filter fieldId). ${COMPILED_SQL_FIELD_ID_HINT}\n` +
      `Lightdash: /* ${errorComment} */`
    );
  }
  const missing = findMissingFieldIds(requestedFieldIds, sql);
  if (missing.length > 0) {
    return (
      'Error: compile_query SQL is missing SELECT aliases for requested fieldIds: ' +
      `${missing.join(', ')}. ${COMPILED_SQL_FIELD_ID_HINT}`
    );
  }
  return undefined;
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
