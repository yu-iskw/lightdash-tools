/**
 * Generic helper to fetch all pages of a Knex-paginated API and return a single array.
 */

import type { KnexPage } from './types';

const DEFAULT_PAGE_SIZE = 100;

export interface FetchAllPagesOptions<T> {
  /** Fetches one page. Called with 1-based page number and page size. */
  fetchPage: (page: number, pageSize: number) => Promise<KnexPage<T>>;
  /** Page size per request. Default 100. */
  pageSize?: number;
}

/**
 * Fetches all pages by repeatedly calling fetchPage until no more pages, then returns
 * the concatenated data array.
 */
export async function fetchAllPages<T>(options: FetchAllPagesOptions<T>): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const all: T[] = [];
  let page = 1;
  let totalPageCount: number | undefined;

  do {
    const result = await options.fetchPage(page, pageSize);
    all.push(...result.data);

    if (result.pagination) {
      totalPageCount = result.pagination.totalPageCount;
      page += 1;
    } else {
      totalPageCount = undefined;
    }
  } while (totalPageCount !== undefined && page <= totalPageCount);

  return all;
}
