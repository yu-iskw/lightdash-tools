/**
 * Normalize and bound async query results for content-reader.
 */

import { HARD_ROW_MAXIMUM, MAX_CELL_CHARS } from '../../policy/result-limits.js';

export type NormalizedQueryField = {
  fieldId: string;
  label: string;
  type?: string;
};

export type NormalizedQueryResult = {
  queryUuid: string;
  status: 'cancelled' | 'complete' | 'failed' | 'running';
  fields: NormalizedQueryField[];
  rows?: Array<Record<string, unknown>>;
  rowCount?: number;
  truncated: boolean;
  cache?: { hit?: boolean; updatedAt?: string; expiresAt?: string };
  error?: string;
  warnings: string[];
};

function truncateCell(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_CELL_CHARS) {
    return `${value.slice(0, MAX_CELL_CHARS)}…`;
  }
  return value;
}

function rowFromResultRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, cell] of Object.entries(row as Record<string, unknown>)) {
    if (cell && typeof cell === 'object' && 'value' in cell) {
      const typed = cell as { value?: { raw?: unknown; formatted?: unknown } };
      // eslint-disable-next-line security/detect-object-injection -- Object.entries keys
      out[key] = truncateCell(typed.value?.formatted ?? typed.value?.raw ?? typed.value);
    } else {
      // eslint-disable-next-line security/detect-object-injection -- Object.entries keys
      out[key] = truncateCell(cell);
    }
  }
  return out;
}

function mapStatus(
  statusRaw: string,
): Exclude<NormalizedQueryResult['status'], 'complete'> | undefined {
  if (statusRaw === 'pending' || statusRaw === 'queued' || statusRaw === 'executing') {
    return 'running';
  }
  if (statusRaw === 'cancelled') {
    return 'cancelled';
  }
  if (statusRaw === 'error' || statusRaw === 'expired') {
    return 'failed';
  }
  return undefined;
}

function extractFields(columns: unknown): NormalizedQueryField[] {
  if (!columns || typeof columns !== 'object' || Array.isArray(columns)) {
    return [];
  }
  return Object.entries(columns as Record<string, unknown>).map(([fieldId, meta]) => {
    const m = meta as { label?: string; type?: string } | undefined;
    return { fieldId, label: m?.label ?? fieldId, type: m?.type };
  });
}

function earlyStatusResult(
  queryUuid: string,
  status: Exclude<NormalizedQueryResult['status'], 'complete'>,
  statusRaw: string,
  error: unknown,
): NormalizedQueryResult {
  if (status === 'running') {
    return {
      queryUuid,
      status: 'running',
      fields: [],
      truncated: false,
      warnings: ['QUERY_RUNNING'],
    };
  }
  if (status === 'cancelled') {
    return { queryUuid, status: 'cancelled', fields: [], truncated: false, warnings: [] };
  }
  return {
    queryUuid,
    status: 'failed',
    fields: [],
    truncated: false,
    error: typeof error === 'string' ? error : statusRaw,
    warnings: [],
  };
}

function mapCache(
  cacheMeta: { cacheHit?: boolean; cacheUpdatedTime?: string; cacheExpiresAt?: string } | undefined,
): NormalizedQueryResult['cache'] {
  if (!cacheMeta) {
    return undefined;
  }
  return {
    hit: cacheMeta.cacheHit,
    updatedAt: cacheMeta.cacheUpdatedTime,
    expiresAt: cacheMeta.cacheExpiresAt,
  };
}

function completeResult(obj: Record<string, unknown>, maxRows: number): NormalizedQueryResult {
  const warnings: string[] = [];
  const queryUuid = typeof obj.queryUuid === 'string' ? obj.queryUuid : '';
  const fields = extractFields(obj.columns);
  const rawRows = Array.isArray(obj.rows) ? obj.rows : [];
  const totalResults =
    typeof obj.totalResults === 'number' && Number.isFinite(obj.totalResults)
      ? obj.totalResults
      : undefined;
  const truncated =
    rawRows.length > maxRows || (totalResults !== undefined && totalResults > maxRows);
  if (truncated) {
    warnings.push('TRUNCATED');
  }
  const rows = rawRows.slice(0, maxRows).map(rowFromResultRow);
  return {
    queryUuid,
    status: 'complete',
    fields,
    rows,
    rowCount: rows.length,
    truncated,
    cache: mapCache(
      obj.cacheMetadata as
        { cacheHit?: boolean; cacheUpdatedTime?: string; cacheExpiresAt?: string } | undefined,
    ),
    warnings,
  };
}

/** Map Lightdash async query payload into a bounded reader result. */
export function normalizeAsyncQueryResult(
  raw: unknown,
  opts?: { maxRows?: number },
): NormalizedQueryResult {
  const maxRows = Math.min(opts?.maxRows ?? HARD_ROW_MAXIMUM, HARD_ROW_MAXIMUM);
  if (!raw || typeof raw !== 'object') {
    return {
      queryUuid: '',
      status: 'failed',
      fields: [],
      truncated: false,
      error: 'Empty query result',
      warnings: [],
    };
  }
  const obj = raw as Record<string, unknown>;
  const queryUuid = typeof obj.queryUuid === 'string' ? obj.queryUuid : '';
  const statusRaw = typeof obj.status === 'string' ? obj.status : '';
  const early = mapStatus(statusRaw);
  if (early) {
    return earlyStatusResult(queryUuid, early, statusRaw, obj.error);
  }
  return completeResult(obj, maxRows);
}
