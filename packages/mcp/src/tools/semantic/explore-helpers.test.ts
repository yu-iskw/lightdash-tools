import { describe, expect, it } from 'vitest';

import {
  extractCompiledSql,
  flattenExploreDimensions,
  isEmptySelectSql,
  summarizeDimensions,
  summarizeExplores,
  toExploreSummary,
} from './explore-helpers.js';

import type { ApiExploreResults, ApiExploresResults } from '@lightdash-tools/common';

describe('toExploreSummary', () => {
  it('keeps name, label, tags, dataset path, and errors/warnings', () => {
    expect(
      toExploreSummary({
        name: 'orders',
        label: 'Orders',
        tags: ['sales'],
        databaseName: 'proj',
        schemaName: 'analytics',
        warnings: [{ message: 'warn', type: 'FIELD_ERROR' }],
      } as unknown as ApiExploresResults[number]),
    ).toEqual({
      name: 'orders',
      label: 'Orders',
      tags: ['sales'],
      databaseName: 'proj',
      schemaName: 'analytics',
      warnings: [{ message: 'warn', type: 'FIELD_ERROR' }],
    });

    expect(
      toExploreSummary({
        name: 'broken',
        label: 'Broken',
        errors: [{ message: 'compile failed', type: 'NO_DIMENSIONS_FOUND' }],
      } as unknown as ApiExploresResults[number]),
    ).toEqual({
      name: 'broken',
      label: 'Broken',
      errors: [{ message: 'compile failed', type: 'NO_DIMENSIONS_FOUND' }],
    });
  });
});

describe('summarizeExplores', () => {
  const explores = [
    {
      name: 'acme_analytics__dm_sales__eda_session_summary',
      label: 'eda_session',
      tags: ['daily'],
      databaseName: 'acme-analytics-prd',
      schemaName: 'dm_sales',
    },
    {
      name: 'orders',
      label: 'Orders',
      tags: ['sales'],
      databaseName: 'db',
      schemaName: 'public',
    },
    {
      name: 'customers',
      label: 'Customers',
      tags: ['crm'],
      databaseName: 'db',
      schemaName: 'public',
    },
  ] as ApiExploresResults;

  it('filters by search on name, label, tag, or schema', () => {
    expect(summarizeExplores(explores, { search: 'session' })).toEqual([
      {
        name: 'acme_analytics__dm_sales__eda_session_summary',
        label: 'eda_session',
        tags: ['daily'],
        databaseName: 'acme-analytics-prd',
        schemaName: 'dm_sales',
      },
    ]);
    expect(summarizeExplores(explores, { search: 'crm' })).toEqual([
      {
        name: 'customers',
        label: 'Customers',
        tags: ['crm'],
        databaseName: 'db',
        schemaName: 'public',
      },
    ]);
    expect(summarizeExplores(explores, { search: 'dm_sales' })).toHaveLength(1);
  });

  it('treats whitespace-only search like no search (limit 100)', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      name: `e${i}`,
      label: `E${i}`,
      tags: [] as string[],
      databaseName: 'db',
      schemaName: 's',
    })) as ApiExploresResults;
    expect(summarizeExplores(many, { search: '   ' })).toHaveLength(100);
  });

  it('defaults limit to 50 when search is set and 100 when unset', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      name: `e${i}`,
      label: `E${i}`,
      tags: [] as string[],
      databaseName: 'db',
      schemaName: 's',
    })) as ApiExploresResults;
    expect(summarizeExplores(many)).toHaveLength(100);
    expect(summarizeExplores(many, { search: 'e1' }).length).toBeLessThanOrEqual(50);
    expect(summarizeExplores(many, { search: 'e', limit: 3 })).toHaveLength(3);
  });
});

describe('summarizeDimensions', () => {
  it('keeps compact fields and adds fieldId as table_name', () => {
    expect(
      summarizeDimensions([
        {
          name: 'created_at',
          table: 'orders',
          label: 'Created at',
          type: 'timestamp',
        },
        { name: 'orphan', table: 't' },
      ]),
    ).toEqual([
      {
        name: 'created_at',
        table: 'orders',
        label: 'Created at',
        type: 'timestamp',
        fieldId: 'orders_created_at',
      },
      { name: 'orphan', table: 't', fieldId: 't_orphan' },
    ]);
    // Fat fields from the API must not appear on the summary.
    expect(
      Object.keys(
        summarizeDimensions([
          {
            name: 'x',
            table: 't',
            label: 'X',
            type: 'string',
          },
        ])[0],
      ).sort(),
    ).toEqual(['fieldId', 'label', 'name', 'table', 'type']);
  });

  it('filters to base table when baseTable is set', () => {
    expect(
      summarizeDimensions(
        [
          { name: 'a', table: 'orders' },
          { name: 'b', table: 'customers' },
        ],
        { baseTable: 'orders' },
      ),
    ).toEqual([{ name: 'a', table: 'orders', fieldId: 'orders_a' }]);
  });

  it('uses explore.baseTable when it differs from explore name/id', () => {
    const explore = {
      name: 'eda_orders_explore',
      baseTable: 'orders',
      tables: {
        orders: {
          dimensions: {
            id: { name: 'id', table: 'orders', label: 'Id', type: 'string' },
          },
        },
        customers: {
          dimensions: {
            name: { name: 'name', table: 'customers', label: 'Name', type: 'string' },
          },
        },
      },
    } as unknown as ApiExploreResults;

    const { baseTable, dimensions } = flattenExploreDimensions(explore);
    expect(baseTable).toBe('orders');
    expect(summarizeDimensions(dimensions, { baseTable })).toEqual([
      { name: 'id', table: 'orders', label: 'Id', type: 'string', fieldId: 'orders_id' },
    ]);
    // Filtering by exploreId (name) would drop every base-table dimension.
    expect(summarizeDimensions(dimensions, { baseTable: explore.name })).toEqual([]);
  });
});

describe('isEmptySelectSql / extractCompiledSql', () => {
  it('detects empty SELECT projections', () => {
    expect(isEmptySelectSql('SELECT\n\nFROM `t`')).toBe(true);
    expect(isEmptySelectSql('SELECT col FROM t')).toBe(false);
    expect(extractCompiledSql({ query: 'SELECT 1' })).toBe('SELECT 1');
    expect(extractCompiledSql('raw')).toBe('raw');
  });
});
