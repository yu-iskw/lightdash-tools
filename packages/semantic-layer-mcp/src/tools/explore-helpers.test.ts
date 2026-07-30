import { describe, expect, it } from 'vitest';

import { summarizeDimensions, summarizeExplores, toExploreSummary } from './explore-helpers.js';

import type { ApiExploresResults } from '@lightdash-tools/common';

describe('toExploreSummary', () => {
  it('keeps name, label, tags, dataset path, and errors/warnings', () => {
    expect(
      toExploreSummary({
        name: 'orders',
        label: 'Orders',
        tags: ['sales'],
        databaseName: 'proj',
        schemaName: 'dwh_pharma',
        warnings: [{ message: 'warn', type: 'FIELD_ERROR' }],
      } as unknown as ApiExploresResults[number]),
    ).toEqual({
      name: 'orders',
      label: 'Orders',
      tags: ['sales'],
      databaseName: 'proj',
      schemaName: 'dwh_pharma',
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
      name: 'ubie_jp_phr_dwh__dm_pharma__eda_medico_session_summary',
      label: 'eda_medico',
      tags: ['daily'],
      databaseName: 'ubie-jp-phr-dwh-prd',
      schemaName: 'dm_pharma',
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
    expect(summarizeExplores(explores, { search: 'medico' })).toEqual([
      {
        name: 'ubie_jp_phr_dwh__dm_pharma__eda_medico_session_summary',
        label: 'eda_medico',
        tags: ['daily'],
        databaseName: 'ubie-jp-phr-dwh-prd',
        schemaName: 'dm_pharma',
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
    expect(summarizeExplores(explores, { search: 'dm_pharma' })).toHaveLength(1);
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
          name: 'last_created_at_jst',
          table: 'fdd',
          label: 'Last created',
          type: 'timestamp',
        },
        { name: 'orphan', table: 't' },
      ]),
    ).toEqual([
      {
        name: 'last_created_at_jst',
        table: 'fdd',
        label: 'Last created',
        type: 'timestamp',
        fieldId: 'fdd_last_created_at_jst',
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
});
