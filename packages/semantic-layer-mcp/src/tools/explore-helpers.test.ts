import { describe, expect, it } from 'vitest';

import { summarizeExplores, toExploreSummary, withDimensionFieldIds } from './explore-helpers.js';

describe('toExploreSummary', () => {
  it('keeps name, label, and tags only', () => {
    expect(
      toExploreSummary({
        name: 'orders',
        label: 'Orders',
        tags: ['sales'],
        tables: { huge: true },
      }),
    ).toEqual({ name: 'orders', label: 'Orders', tags: ['sales'] });
  });

  it('skips items without a name', () => {
    expect(toExploreSummary({ label: 'x' })).toBeUndefined();
  });
});

describe('summarizeExplores', () => {
  const explores = [
    {
      name: 'ubie_jp_phr_dwh__dm_pharma__eda_medico_session_summary',
      label: 'eda_medico',
      tags: ['daily'],
    },
    { name: 'orders', label: 'Orders', tags: ['sales'] },
    { name: 'customers', label: 'Customers', tags: ['crm'] },
  ];

  it('filters by search on name, label, or tag', () => {
    expect(summarizeExplores(explores, { search: 'medico' })).toEqual([
      {
        name: 'ubie_jp_phr_dwh__dm_pharma__eda_medico_session_summary',
        label: 'eda_medico',
        tags: ['daily'],
      },
    ]);
    expect(summarizeExplores(explores, { search: 'crm' })).toEqual([
      { name: 'customers', label: 'Customers', tags: ['crm'] },
    ]);
  });

  it('defaults limit to 50 when search is set and 100 when unset', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      name: `e${i}`,
      label: `E${i}`,
      tags: [],
    }));
    expect(summarizeExplores(many)).toHaveLength(100);
    expect(summarizeExplores(many, { search: 'e1' }).length).toBeLessThanOrEqual(50);
    expect(summarizeExplores(many, { search: 'e', limit: 3 })).toHaveLength(3);
  });
});

describe('withDimensionFieldIds', () => {
  it('adds fieldId as table_name', () => {
    expect(
      withDimensionFieldIds([
        { name: 'last_created_at_jst', table: 'fdd', type: 'timestamp' },
        { name: 'orphan' },
      ]),
    ).toEqual([
      {
        name: 'last_created_at_jst',
        table: 'fdd',
        type: 'timestamp',
        fieldId: 'fdd_last_created_at_jst',
      },
      { name: 'orphan' },
    ]);
  });
});
