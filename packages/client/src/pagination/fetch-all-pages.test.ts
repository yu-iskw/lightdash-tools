import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';
import type { KnexPage } from './types';

describe('fetchAllPages', () => {
  it('returns concatenated data from multiple pages', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, pageSize: 2, totalResults: 6, totalPageCount: 3 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 3 }, { id: 4 }],
        pagination: { page: 2, pageSize: 2, totalResults: 6, totalPageCount: 3 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 5 }, { id: 6 }],
        pagination: { page: 3, pageSize: 2, totalResults: 6, totalPageCount: 3 },
      });

    const result = await fetchAllPages<{ id: number }>({ fetchPage, pageSize: 2 });

    expect(result).toHaveLength(6);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 2);
  });

  it('returns single page when no pagination', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      data: [{ x: 'a' }],
    } as KnexPage<{ x: string }>);

    const result = await fetchAllPages<{ x: string }>({ fetchPage });

    expect(result).toEqual([{ x: 'a' }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1, 100);
  });

  it('returns single page when totalPageCount is 1', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      data: [{ a: 1 }],
      pagination: { page: 1, pageSize: 10, totalResults: 1, totalPageCount: 1 },
    });

    const result = await fetchAllPages<{ a: number }>({ fetchPage, pageSize: 10 });

    expect(result).toEqual([{ a: 1 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when first page has no data and no pagination', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ data: [] } as KnexPage<unknown>);

    const result = await fetchAllPages({ fetchPage });

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('uses default page size when not provided', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 100, totalResults: 0, totalPageCount: 1 },
    });

    await fetchAllPages({ fetchPage });

    expect(fetchPage).toHaveBeenCalledWith(1, 100);
  });
});
