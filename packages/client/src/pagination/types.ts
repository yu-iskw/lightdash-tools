/**
 * Minimal type for one page of Knex-paginated API results.
 * Matches the shape returned by list endpoints (e.g. /org/users, /org/groups).
 */

export interface KnexPagePagination {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPageCount: number;
}

export interface KnexPage<T> {
  data: T[];
  pagination?: KnexPagePagination;
}
