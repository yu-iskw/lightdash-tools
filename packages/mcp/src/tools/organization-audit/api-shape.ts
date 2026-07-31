/**
 * Normalize Lightdash list/paginated responses across typed wrappers.
 * HttpClient unwraps `{ status, results }`, but some client method types still
 * declare the outer ApiSuccess envelope — accept either shape.
 */

export type PaginatedSlice<T> = {
  data: T[];
  pagination?: {
    page?: number;
    pageSize?: number;
    totalResults?: number;
    totalPageCount?: number;
  };
};

export function asPaginated<T>(raw: unknown): PaginatedSlice<T> {
  if (Array.isArray(raw)) {
    return { data: raw as T[] };
  }
  if (!raw || typeof raw !== 'object') {
    return { data: [] };
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.data)) {
    return {
      data: obj.data as T[],
      pagination: obj.pagination as PaginatedSlice<T>['pagination'],
    };
  }
  if (obj.results && typeof obj.results === 'object') {
    const results = obj.results as Record<string, unknown>;
    if (Array.isArray(results.data)) {
      return {
        data: results.data as T[],
        pagination: results.pagination as PaginatedSlice<T>['pagination'],
      };
    }
    if (Array.isArray(results)) {
      return { data: results as T[] };
    }
  }
  return { data: [] };
}

export function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.results && typeof obj.results === 'object' && !Array.isArray(obj.results)) {
      return obj.results as Record<string, unknown>;
    }
    return obj;
  }
  return {};
}
